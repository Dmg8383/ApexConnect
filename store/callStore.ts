import { create } from 'zustand/index.js';
import { getSocket } from '@/lib/ws';
import { Platform, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export interface CallState {
  isReceivingCall: boolean;
  isActiveCall: boolean;
  callerId: string | null;
  calleeId: string | null;
  conversationId: string | null;
  isVideoCall: boolean;
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callStartTime: number | null;

  initiateCall: (conversationId: string, calleeId: string, isVideo: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  initCallListeners: () => void;
}

let peerConnection: any | null = null;
let mediaRecorder: any | null = null;
let recordedChunks: Blob[] = [];

// Polyfill WebRTC for Native
let RTCConnection: any;
let RTCSessionDesc: any;
let RTCIceCand: any;
let mediaDevs: any;
let MediaStreamClass: any;

if (Platform.OS === 'web') {
  RTCConnection = window.RTCPeerConnection;
  RTCSessionDesc = window.RTCSessionDescription;
  RTCIceCand = window.RTCIceCandidate;
  mediaDevs = navigator.mediaDevices;
  MediaStreamClass = window.MediaStream;
} else {
  try {
    const webrtc = require('react-native-webrtc');
    RTCConnection = webrtc.RTCPeerConnection;
    RTCSessionDesc = webrtc.RTCSessionDescription;
    RTCIceCand = webrtc.RTCIceCandidate;
    mediaDevs = webrtc.mediaDevices;
    MediaStreamClass = webrtc.MediaStream;
  } catch (e) {
    console.warn('react-native-webrtc is not installed. Native calls will fail.');
  }
}

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ]
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';

export const useCallStore = create<CallState>((set, get) => ({
  isReceivingCall: false,
  isActiveCall: false,
  callerId: null,
  calleeId: null,
  conversationId: null,
  isVideoCall: false,
  localStreamUrl: null,
  remoteStreamUrl: null,
  localStream: null,
  remoteStream: null,
  callStartTime: null,

  initCallListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('call_offer', async (data) => {
      // Received an incoming call
      set({
        isReceivingCall: true,
        callerId: data.callerId,
        conversationId: data.conversationId,
        isVideoCall: data.isVideo,
      });

      // Prepare peer connection
      if (!RTCConnection) {
         console.warn('WebRTC not supported or react-native-webrtc missing');
         return;
      }
      peerConnection = new RTCConnection(configuration);
      peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            conversationId: data.conversationId,
            targetId: data.callerId,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event: any) => {
        set({ remoteStream: event.streams[0] });
      };

      await peerConnection.setRemoteDescription(new RTCSessionDesc(data.offer));
    });

    socket.on('call_answer', async (data) => {
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDesc(data.answer));
        set({ isActiveCall: true, callStartTime: Date.now() });
        
        const remoteStream = get().remoteStream;
        if (Platform.OS === 'web' && remoteStream && !mediaRecorder && window.MediaRecorder) {
          try {
            const audioTracks = remoteStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const audioStream = new MediaStreamClass([audioTracks[0]]);
              mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
              mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunks.push(e.data);
              };
              mediaRecorder.start(1000);
            }
          } catch (e) {
            console.error('Failed to start MediaRecorder:', e);
          }
        }
      }
    });

    socket.on('ice_candidate', async (data) => {
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCand(data.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    socket.on('call_end', () => {
      get().endCall();
    });
  },

  initiateCall: async (conversationId: string, calleeId: string, isVideo: boolean) => {
    try {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        const { status: audioStatus } = await Audio.requestPermissionsAsync();
        if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Camera and Microphone permissions are required to make calls.');
          get().endCall();
          return;
        }
      }

      if (!mediaDevs || !RTCConnection) {
        Alert.alert('Error', 'WebRTC is not supported on this device. Install react-native-webrtc.');
        get().endCall();
        return;
      }

      let stream;
      try {
        stream = await mediaDevs.getUserMedia({
          video: isVideo,
          audio: true,
        });
      } catch (mediaErr: any) {
        const msg = `Could not access camera/microphone: ${mediaErr.message}. Ensure no other app is using them.`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Media Error', msg);
        get().endCall();
        return;
      }
      set({ localStream: stream, isActiveCall: true, conversationId, calleeId, isVideoCall: isVideo });

      peerConnection = new RTCConnection(configuration);
      stream.getTracks().forEach((track) => {
        peerConnection?.addTrack(track, stream);
      });

      const socket = getSocket();
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice_candidate', {
            conversationId,
            targetId: calleeId,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (socket) {
        const { useAuthStore } = require('./authStore');
        socket.emit('call_offer', {
          conversationId,
          targetId: calleeId,
          callerId: useAuthStore.getState().userId,
          offer,
          isVideo,
        });
      }
    } catch (err) {
      console.error('Error starting call', err);
      get().endCall();
    }
  },

  acceptCall: async () => {
    const { conversationId, isVideoCall, callerId } = get();
    if (!conversationId || !peerConnection) return;

    try {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        const { status: audioStatus } = await Audio.requestPermissionsAsync();
        if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Camera and Microphone permissions are required to accept calls.');
          get().endCall();
          return;
        }
      }

      if (!mediaDevs) {
        Alert.alert('Error', 'WebRTC is not supported on this device.');
        get().endCall();
        return;
      }

      let stream;
      try {
        stream = await mediaDevs.getUserMedia({
          video: isVideoCall,
          audio: true,
        });
      } catch (mediaErr: any) {
        const msg = `Could not access camera/microphone: ${mediaErr.message}. Ensure no other app is using them.`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Media Error', msg);
        get().endCall();
        return;
      }
      set({ localStream: stream, isReceivingCall: false, isActiveCall: true, callStartTime: Date.now() });

      stream.getTracks().forEach((track: any) => {
        peerConnection?.addTrack(track, stream);
      });

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const socket = getSocket();
      if (socket) {
        socket.emit('call_answer', {
          conversationId,
          targetId: callerId,
          answer,
        });
      }
    } catch (err) {
      console.error('Error accepting call', err);
      get().endCall();
    }
  },

  rejectCall: () => {
    const socket = getSocket();
    const { conversationId, callerId, calleeId, isVideoCall } = get();
    if (socket && conversationId) {
      socket.emit('call_end', { conversationId, targetId: callerId || calleeId });
    }
    
    // Log missed call
    const { useAuthStore } = require('./authStore');
    const { useCallsHistoryStore } = require('./callsHistoryStore');
    const myId = useAuthStore.getState().userId;
    if (myId && callerId) {
      useCallsHistoryStore.getState().logCall({
        caller_id: callerId,
        receiver_id: myId,
        type: isVideoCall ? 'video' : 'audio',
        status: 'rejected',
        duration: 0,
      });
    }

    get().endCall();
  },

  endCall: () => {
    const { localStream, conversationId, isActiveCall, isVideoCall, callerId, calleeId, callStartTime } = get();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    
    // Stop recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    // Log accepted call and upload recording
    if (isActiveCall) {
      const { useAuthStore } = require('./authStore');
      const { useCallsHistoryStore } = require('./callsHistoryStore');
      const myId = useAuthStore.getState().userId;
      
      const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
      
      // If we are the caller, we use calleeId. If we are the receiver, we use callerId.
      const logCallerId = callerId ? callerId : myId;
      const logReceiverId = callerId ? myId : (calleeId || myId);
      
      if (myId) {
        useCallsHistoryStore.getState().logCall({
          caller_id: logCallerId,
          receiver_id: logReceiverId,
          type: isVideoCall ? 'video' : 'audio',
          status: 'accepted',
          duration,
        }).then((newCall: any) => {
          // If we have a recording and we logged the call, upload it
          if (newCall && newCall.id && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const formData = new FormData();
            formData.append('recording', blob, `call-${newCall.id}.webm`);
            
            fetch(`${API_URL}/api/calls/${newCall.id}/recording`, {
              method: 'POST',
              body: formData,
            }).then(res => res.json())
              .then(data => {
                console.log('Recording uploaded successfully:', data);
                // Refresh calls to get the recording URL
                useCallsHistoryStore.getState().fetchCalls(myId);
              })
              .catch(err => console.error('Failed to upload recording:', err))
              .finally(() => {
                recordedChunks = [];
                mediaRecorder = null;
              });
          } else {
            recordedChunks = [];
            mediaRecorder = null;
          }
        });
      }
    }

    // Also notify the other peer if we initiated the end
    const socket = getSocket();
    if (socket && conversationId) {
      const targetId = callerId || calleeId;
      socket.emit('call_end', { conversationId, targetId });
    }

    set({
      isReceivingCall: false,
      isActiveCall: false,
      callerId: null,
      calleeId: null,
      conversationId: null,
      localStream: null,
      remoteStream: null,
      callStartTime: null,
    });
  },
}));
