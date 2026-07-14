import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal, Image, ScrollView, Dimensions } from 'react-native';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react-native';
import { useCallStore } from '@/store/callStore';
import { useAuthStore } from '@/store/authStore';
import { useMessagesStore } from '@/store/messagesStore';
import { getMediaUrl } from '@/lib/media';

// Web Media Component (Supports both Audio and Video)
const WebMedia = ({ stream, isLocal, isVideo }: { stream: MediaStream | null, isLocal: boolean, isVideo: boolean }) => {
  const mediaRef = useRef<any>(null);

  useEffect(() => {
    if (mediaRef.current && stream) {
      mediaRef.current.srcObject = stream;
    }
  }, [stream]);

  if (Platform.OS !== 'web') return <View style={styles.webVideoPlaceholder}><Text style={{color:'white'}}>Requires Web</Text></View>;

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

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export function CallOverlay() {
  const {
    isReceivingCall,
    isActiveCall,
    isVideoCall,
    localStream,
    remoteStreams,
    conversationId,
    initiatorId,
    acceptCall,
    rejectCall,
    endCall
  } = useCallStore();

  const { theme, userId } = useAuthStore();
  const { conversations } = useMessagesStore();
  const isDark = theme === 'dark';

  if (!isReceivingCall && !isActiveCall) return null;

  const conversation = conversations.find(c => c.id === conversationId);
  const participants = conversation?.participants || [];
  
  // For incoming calls
  const caller = participants.find(p => p.id === initiatorId);
  const callerName = caller?.display_name || 'Unknown Caller';
  const avatarUrl = caller?.avatar_url ? getMediaUrl(caller.avatar_url) : null;

  const remoteStreamEntries = Object.entries(remoteStreams);
  const isGroupCall = conversation?.type === 'group' || remoteStreamEntries.length > 1;

  // Calculate grid layout based on number of participants
  const totalStreams = remoteStreamEntries.length + 1; // +1 for local stream in grid (if group)
  
  return (
    <Modal visible={true} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        {/* Remote Video Streams */}
        {isVideoCall && isActiveCall && (
          <View style={styles.videoGrid}>
            {isGroupCall ? (
              <ScrollView contentContainerStyle={styles.scrollGrid}>
                {remoteStreamEntries.map(([peerId, stream]) => {
                  const peer = participants.find(p => p.id === peerId);
                  return (
                    <View key={peerId} style={[styles.gridItem, { width: totalStreams > 2 ? windowWidth / 2 - 20 : windowWidth - 40, height: totalStreams > 2 ? 200 : windowHeight * 0.4 }]}>
                      <WebMedia stream={stream} isLocal={false} isVideo={true} />
                      <View style={styles.nameBadge}>
                        <Text style={styles.nameBadgeText}>{peer?.display_name || 'Participant'}</Text>
                      </View>
                    </View>
                  );
                })}
                {/* Local user in grid for group calls */}
                {localStream && (
                  <View style={[styles.gridItem, { width: totalStreams > 2 ? windowWidth / 2 - 20 : windowWidth - 40, height: totalStreams > 2 ? 200 : windowHeight * 0.4 }]}>
                    <WebMedia stream={localStream} isLocal={true} isVideo={true} />
                    <View style={styles.nameBadge}>
                      <Text style={styles.nameBadgeText}>You</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            ) : (
              // 1-on-1 Call Layout
              <>
                {remoteStreamEntries[0] && (
                  <View style={styles.remoteVideoContainer}>
                    <WebMedia stream={remoteStreamEntries[0][1]} isLocal={false} isVideo={true} />
                  </View>
                )}
                {localStream && (
                  <View style={styles.localVideoContainer}>
                    <WebMedia stream={localStream} isLocal={true} isVideo={true} />
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {!isVideoCall && (
          <View style={styles.audioCallAvatar}>
             {avatarUrl ? (
               Platform.OS === 'web' ? (
                 <img src={typeof avatarUrl === 'object' ? (avatarUrl as any).uri : avatarUrl} style={{ width: 140, height: 140, borderRadius: 70, objectFit: 'cover' }} alt="Avatar" />
               ) : (
                 <Image source={{ uri: avatarUrl as string }} style={{ width: 140, height: 140, borderRadius: 70 }} />
               )
             ) : (
               <View style={styles.avatarPlaceholder}>
                 <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
               </View>
             )}
             
             <Text style={styles.callerNameText}>{isGroupCall ? conversation?.name || 'Group Call' : callerName}</Text>
             <Text style={styles.audioCallText}>
               {isActiveCall ? `Active Audio Call (${remoteStreamEntries.length + 1} participants)` : 'Ringing...'}
             </Text>
             
             {/* Invisible audio tags for voice transmission */}
             {isActiveCall && remoteStreamEntries.map(([id, stream]) => (
                <WebMedia key={id} stream={stream} isLocal={false} isVideo={false} />
             ))}
             {isActiveCall && localStream && <WebMedia stream={localStream} isLocal={true} isVideo={false} />}
          </View>
        )}

        <View style={styles.controlsContainer}>
          {isReceivingCall && !isActiveCall ? (
            <>
              <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity style={[styles.controlButton, styles.rejectButton]} onPress={rejectCall}>
                    <PhoneOff color="white" size={32} />
                  </TouchableOpacity>
                  <Text style={styles.buttonLabel}>Decline</Text>
                </View>
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity style={[styles.controlButton, styles.acceptButton]} onPress={acceptCall}>
                    <Phone color="white" size={32} />
                  </TouchableOpacity>
                  <Text style={styles.buttonLabel}>Accept</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.buttonRow}>
              <View style={styles.buttonWrapper}>
                <TouchableOpacity style={[styles.controlButton, styles.muteButton]}>
                  <Mic color="white" size={28} />
                </TouchableOpacity>
                <Text style={styles.buttonLabel}>Mute</Text>
              </View>
              {isVideoCall && (
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity style={[styles.controlButton, styles.muteButton]}>
                    <Video color="white" size={28} />
                  </TouchableOpacity>
                  <Text style={styles.buttonLabel}>Video</Text>
                </View>
              )}
              <View style={styles.buttonWrapper}>
                <TouchableOpacity style={[styles.controlButton, styles.rejectButton]} onPress={endCall}>
                  <PhoneOff color="white" size={32} />
                </TouchableOpacity>
                <Text style={styles.buttonLabel}>End</Text>
              </View>
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
  videoGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  scrollGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingTop: 40,
    paddingHorizontal: 10,
    gap: 10,
  },
  gridItem: {
    backgroundColor: '#333',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  nameBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nameBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
    width: '100%',
    alignItems: 'center',
    marginBottom: 80,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '600',
    color: 'white',
  },
  callerNameText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
    textAlign: 'center',
  },
  audioCallText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 60,
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
    gap: 48,
  },
  buttonWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  buttonLabel: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
