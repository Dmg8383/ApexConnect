import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react-native';
import { useCallStore } from '@/store/callStore';
import { useAuthStore } from '@/store/authStore';

// Web Media Component (Supports both Audio and Video)
const WebMedia = ({ stream, isLocal, isVideo }: { stream: MediaStream | null, isLocal: boolean, isVideo: boolean }) => {
  const mediaRef = useRef<any>(null);

  useEffect(() => {
    if (mediaRef.current && stream) {
      mediaRef.current.srcObject = stream;
    }
  }, [stream]);

  if (Platform.OS !== 'web') return <View style={styles.webVideoPlaceholder}><Text style={{color:'white'}}>Requires Web</Text></View>;

  // Use createElement to avoid Native errors
  const { createElement } = require('react-native-web');
  
  if (!isVideo) {
    return createElement('audio', {
      ref: mediaRef,
      autoPlay: true,
      playsInline: true,
      muted: isLocal,
      style: { display: 'none' }
    });
  }

  return createElement('video', {
    ref: mediaRef,
    autoPlay: true,
    playsInline: true,
    muted: isLocal,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: isLocal ? 'scaleX(-1)' : 'none',
    }
  });
};

export function CallOverlay() {
  const {
    isReceivingCall,
    isActiveCall,
    isVideoCall,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall
  } = useCallStore();

  const { theme } = useAuthStore();
  const isDark = theme === 'dark';

  if (!isReceivingCall && !isActiveCall) return null;

  return (
    <Modal visible={true} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        {/* Remote Video Background */}
        {isVideoCall && isActiveCall && remoteStream && (
          <View style={styles.remoteVideoContainer}>
            <WebMedia stream={remoteStream} isLocal={false} isVideo={true} />
          </View>
        )}

        {/* Local Video Thumbnail */}
        {isVideoCall && isActiveCall && localStream && (
          <View style={styles.localVideoContainer}>
            <WebMedia stream={localStream} isLocal={true} isVideo={true} />
          </View>
        )}

        {!isVideoCall && (
          <View style={styles.audioCallAvatar}>
             <Text style={styles.audioCallText}>ApexConnect Audio Call</Text>
             {/* Invisible audio tags for voice transmission */}
             {isActiveCall && remoteStream && <WebMedia stream={remoteStream} isLocal={false} isVideo={false} />}
             {isActiveCall && localStream && <WebMedia stream={localStream} isLocal={true} isVideo={false} />}
          </View>
        )}

        <View style={styles.controlsContainer}>
          {isReceivingCall && !isActiveCall ? (
            <>
              <Text style={styles.incomingText}>Incoming {isVideoCall ? 'Video' : 'Audio'} Call...</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.controlButton, styles.rejectButton]} onPress={rejectCall}>
                  <PhoneOff color="white" size={32} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.controlButton, styles.acceptButton]} onPress={acceptCall}>
                  <Phone color="white" size={32} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.controlButton, styles.muteButton]}>
                <Mic color="white" size={28} />
              </TouchableOpacity>
              {isVideoCall && (
                <TouchableOpacity style={[styles.controlButton, styles.muteButton]}>
                  <Video color="white" size={28} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.controlButton, styles.rejectButton]} onPress={endCall}>
                <PhoneOff color="white" size={32} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  localVideoContainer: {
    position: 'absolute',
    bottom: 150,
    right: 20,
    width: 120,
    height: 160,
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  webVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  audioCallAvatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 100,
  },
  audioCallText: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  incomingText: {
    color: 'white',
    fontSize: 24,
    marginBottom: 30,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 30,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  muteButton: {
    backgroundColor: '#334155',
  },
});
