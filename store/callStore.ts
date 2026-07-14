import { create } from 'zustand/index.js';
import { getSocket } from '@/lib/ws';
import { Platform, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useAuthStore } from './authStore';

export interface CallState {
  isReceivingCall: boolean;
  isActiveCall: boolean;
  initiatorId: string | null;
  targetIds: string[];
  conversationId: string | null;
  isVideoCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  callStartTime: number | null;

  initiateCall: (conversationId: string, targets: string[], isVideo: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  initCallListeners: () => void;
}

let peerConnections: Record<string, any> = {};
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

const createPeerConnection = async (
  targetId: string, 
  conversationId: string, 
  get: any, 
  set: any, 
  isInitiator: boolean
) => {
  if (!RTCConnection) {
    console.warn('WebRTC not supported');
    return null;
  }

  const pc = new RTCConnection(configuration);
  peerConnections[targetId] = pc;

  const localStream = get().localStream;
  if (localStream) {
    localStream.getTracks().forEach((track: any) => {
      pc.addTrack(track, localStream);
    });
  }

  const socket = getSocket();
  pc.onicecandidate = (event: any) => {
    if (event.candidate && socket) {
      socket.emit('ice_candidate', {
        conversationId,
        targetId,
        fromId: useAuthStore.getState().userId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event: any) => {
    const streams = get().remoteStreams;
    set({ remoteStreams: { ...streams, [targetId]: event.streams[0] } });
  };

  if (isInitiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (socket) {
      socket.emit('call_offer', {
        conversationId,
        targetId: [targetId], // Send offer to this specific person
        callerId: useAuthStore.getState().userId,
        offer,
        isVideo: get().isVideoCall,
      });
    }
  }

  return pc;
};


export const useCallStore = create<CallState>((set, get) => ({
  isReceivingCall: false,
  isActiveCall: false,
  initiatorId: null,
  targetIds: [],
  conversationId: null,
  isVideoCall: false,
  localStream: null,
  remoteStreams: {},
  callStartTime: null,

  initCallListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('call_offer', async (data) => {
      const myId = useAuthStore.getState().userId;
      
      if (!get().isActiveCall && !get().isReceivingCall) {
        set({
          isReceivingCall: true,
          initiatorId: data.callerId,
          conversationId: data.conversationId,
          isVideoCall: data.isVideo,
          targetIds: [data.callerId],
        });
      }
      
      if (get().isActiveCall) {
        const pc = await createPeerConnection(data.callerId, data.conversationId, get, set, false);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDesc(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call_answer', {
            conversationId: data.conversationId,
            targetId: data.callerId,
            fromId: myId,
            answer,
          });
        }
      } else {
        (window as any)._pendingOffer = data.offer;
      }
    });

    socket.on('call_answer', async (data) => {
      const pc = peerConnections[data.fromId || data.targetId]; // Target fallback for old clients
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDesc(data.answer));
        
        if (!get().isActiveCall) {
           set({ isActiveCall: true, callStartTime: Date.now() });
        }
        
        if (Platform.OS === 'web' && !mediaRecorder && window.MediaRecorder) {
          const remoteStream = get().remoteStreams[data.fromId || data.targetId];
          if (remoteStream) {
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
      }
    });

    socket.on('ice_candidate', async (data) => {
      const pc = peerConnections[data.fromId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCand(data.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    socket.on('call_end', (data) => {
      const pc = peerConnections[data.fromId];
      if (pc) {
        pc.close();
        delete peerConnections[data.fromId];
        
        const streams = { ...get().remoteStreams };
        delete streams[data.fromId];
        set({ remoteStreams: streams });
        
        if (Object.keys(peerConnections).length === 0) {
          get().endCall();
        }
      } else if (!data.fromId) {
        get().endCall();
      }
    });
  },

  initiateCall: async (conversationId: string, targetIds: string[], isVideo: boolean) => {
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
        Alert.alert('Error', 'WebRTC is not supported on this device.');
        get().endCall();
        return;
      }

      let stream;
      try {
        stream = await mediaDevs.getUserMedia({ video: isVideo, audio: true });
      } catch (mediaErr: any) {
        const msg = `Could not access camera/microphone: ${mediaErr.message}. Ensure no other app is using them.`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Media Error', msg);
        get().endCall();
        return;
      }
      
      const myId = useAuthStore.getState().userId;
      set({ 
        localStream: stream, 
        isActiveCall: true, 
        conversationId, 
        targetIds, 
        initiatorId: myId,
        isVideoCall: isVideo,
        callStartTime: Date.now()
      });

      for (const targetId of targetIds) {
        await createPeerConnection(targetId, conversationId, get, set, true);
      }

    } catch (err) {
      console.error('Error starting call', err);
      get().endCall();
    }
  },

  acceptCall: async () => {
    const { conversationId, isVideoCall, initiatorId } = get();
    if (!conversationId || !initiatorId) return;

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

      let stream;
      try {
        stream = await mediaDevs.getUserMedia({ video: isVideoCall, audio: true });
      } catch (mediaErr: any) {
        const msg = `Could not access camera/microphone: ${mediaErr.message}. Ensure no other app is using them.`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Media Error', msg);
        get().endCall();
        return;
      }
      
      set({ localStream: stream, isReceivingCall: false, isActiveCall: true, callStartTime: Date.now() });

      const socket = getSocket();
      const myId = useAuthStore.getState().userId;
      
      const pc = await createPeerConnection(initiatorId, conversationId, get, set, false);
      if (pc) {
         const pendingOffer = (window as any)._pendingOffer;
         if (pendingOffer) {
           await pc.setRemoteDescription(new RTCSessionDesc(pendingOffer));
           (window as any)._pendingOffer = null;
           
           const answer = await pc.createAnswer();
           await pc.setLocalDescription(answer);
           
           if (socket) {
             socket.emit('call_answer', {
               conversationId,
               targetId: initiatorId,
               fromId: myId,
               answer,
             });
           }
         }
      }
    } catch (err) {
      console.error('Error accepting call', err);
      get().endCall();
    }
  },

  rejectCall: () => {
    const socket = getSocket();
    const { conversationId, initiatorId, targetIds, isVideoCall } = get();
    const myId = useAuthStore.getState().userId;
    
    if (socket && conversationId) {
       socket.emit('call_end', { 
         conversationId, 
         targetId: initiatorId || targetIds, 
         fromId: myId 
       });
    }
    
    const { useCallsHistoryStore } = require('./callsHistoryStore');
    if (myId && initiatorId) {
      useCallsHistoryStore.getState().logCall({
        caller_id: initiatorId,
        receiver_id: myId,
        type: isVideoCall ? 'video' : 'audio',
        status: 'rejected',
        duration: 0,
      });
    }

    get().endCall();
  },

  endCall: () => {
    const { localStream, conversationId, isActiveCall, isVideoCall, initiatorId, targetIds, callStartTime } = get();
    const myId = useAuthStore.getState().userId;
    
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    Object.values(peerConnections).forEach((pc: any) => pc.close());
    peerConnections = {};
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    if (isActiveCall) {
      const { useCallsHistoryStore } = require('./callsHistoryStore');
      const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
      
      const logCallerId = initiatorId || myId;
      const logReceiverId = initiatorId === myId ? targetIds[0] : myId;
      
      if (myId && logReceiverId) {
        useCallsHistoryStore.getState().logCall({
          caller_id: logCallerId,
          receiver_id: logReceiverId,
          type: isVideoCall ? 'video' : 'audio',
          status: 'accepted',
          duration,
        }).then((newCall: any) => {
          if (newCall && newCall.id && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const formData = new FormData();
            formData.append('recording', blob, `call-${newCall.id}.webm`);
            
            fetch(`${API_URL}/api/calls/${newCall.id}/recording`, {
              method: 'POST',
              body: formData,
            }).then(res => res.json())
              .then(() => useCallsHistoryStore.getState().fetchCalls(myId))
              .catch(err => console.error('Failed to upload recording:', err))
              .finally(() => { recordedChunks = []; mediaRecorder = null; });
          } else {
            recordedChunks = []; mediaRecorder = null;
          }
        });
      }
    }

    const socket = getSocket();
    if (socket && conversationId) {
      socket.emit('call_end', { conversationId, targetId: targetIds, fromId: myId });
    }

    set({
      isReceivingCall: false,
      isActiveCall: false,
      initiatorId: null,
      targetIds: [],
      conversationId: null,
      localStream: null,
      remoteStreams: {},
      callStartTime: null,
    });
  },
}));
