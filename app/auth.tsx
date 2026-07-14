import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Copy, Check, UserPlus, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '@/store/authStore';

const isValidPassword = (pwd: string) => {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return re.test(pwd);
};

export default function AuthScreen() {
  const router = useRouter();
  const { createAccount, signIn, isLoading, isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<'create' | 'backup' | 'signin'>('signin');

  // Custom Toast State
  const [toastConfig, setToastConfig] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const toastOpacity = React.useRef(new Animated.Value(0)).current;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastConfig({ visible: true, message, type });
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToastConfig((prev) => ({ ...prev, visible: false })));
      }, 3000);
    });
  };

  const toast = {
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
  };

  // Create Account State
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Sign In State
  const [signinUsername, setSigninUsername] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  // Backup State
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasConfirmedBackup, setHasConfirmedBackup] = useState(false);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const handleCreateAccount = async () => {
    if (!displayName.trim() || !username.trim() || !password) {
      toast.error('Please fill out all fields');
      return;
    }
    if (!isValidPassword(password)) {
      toast.error('Password must be at least 8 chars, include an uppercase, lowercase, number, and special character.');
      return;
    }
    try {
      const generatedMnemonic = useAuthStore.getState().generateMnemonic();
      setMnemonic(generatedMnemonic.split(' '));
      await createAccount(displayName.trim(), username.trim(), password);
      toast.success('Account successfully created. Please save your backup phrase.');
      setStep('backup');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create account.');
    }
  };

  const handleSignIn = async () => {
    if (!signinUsername.trim() || !signinPassword) {
      toast.error('Please enter your username and password');
      return;
    }
    try {
      await signIn(signinUsername.trim(), signinPassword);
      toast.success('Welcome back!');
      router.replace('/(tabs)');
    } catch (err) {
      toast.error('Invalid username or password.');
    }
  };

  const handleConfirmBackup = async () => {
    if (!hasConfirmedBackup) {
      Alert.alert('Error', 'Please confirm you have saved your backup phrase');
      return;
    }
    const user = useAuthStore.getState().user;
    Alert.alert('Account Created!', `Welcome, ${user?.display_name}!`);
    router.replace('/(tabs)');
  };

  const copyMnemonic = async () => {
    await Clipboard.setStringAsync(mnemonic.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const userId = useAuthStore.getState().userId;

  return (
    <View style={styles.container}>
      {/* Premium SaaS Toast Notification Layer */}
      {toastConfig.visible && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 48,
            right: 24,
            zIndex: 9999,
            backgroundColor: '#18181B', // Dark zinc-900 equivalent
            borderWidth: 1,
            borderColor: '#27272A',     // zinc-800 border
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 15 },
            shadowOpacity: 0.4,
            shadowRadius: 25,
            opacity: toastOpacity,
            transform: [
              {
                translateX: toastOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0], // slide in from right
                })
              }
            ],
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            maxWidth: 350,
          }}
        >
          {toastConfig.type === 'success' ? (
            <CheckCircle size={20} color="#10B981" />
          ) : (
            <AlertCircle size={20} color="#EF4444" />
          )}
          <Text style={{ color: '#F4F4F5', fontWeight: '500', fontSize: 14, flexShrink: 1 }}>
            {toastConfig.message}
          </Text>
        </Animated.View>
      )}

      {step === 'signin' && (
        <View style={styles.glassCard}>
          <View style={{ alignItems: 'center', marginBottom: 24, overflow: 'hidden', width: 96, height: 96 }}>
            {Platform.OS === 'web' ? (
              <img 
                src={((require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png') as any).uri) || require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                alt="Logo"
              />
            ) : (
              <Image source={require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            )}
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Enter your credentials to access ApexConnect</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>USERNAME</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.iconContainer}>
                <Mail size={20} color="#9CA3AF" />
              </View>
              <TextInput
                style={styles.insetInput}
                placeholder="johndoe123"
                placeholderTextColor="#9CA3AF"
                value={signinUsername}
                onChangeText={setSigninUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TouchableOpacity><Text style={styles.forgotText}>Forgot?</Text></TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <View style={styles.iconContainer}>
                <Lock size={20} color="#9CA3AF" />
              </View>
              <TextInput
                style={styles.insetInput}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={signinPassword}
                onChangeText={setSigninPassword}
                secureTextEntry={!showSigninPassword}
              />
              <TouchableOpacity 
                style={styles.eyeContainer} 
                onPress={() => setShowSigninPassword(!showSigninPassword)}
              >
                {showSigninPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <ArrowRight size={18} color="white" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={{ color: '#6B7280', fontSize: 14 }}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => setStep('create')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'create' && (
        <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={styles.glassCard}>
          <View style={{ alignItems: 'center', marginBottom: 24, overflow: 'hidden', width: 96, height: 96 }}>
            {Platform.OS === 'web' ? (
              <img 
                src={((require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png') as any).uri) || require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                alt="Logo"
              />
            ) : (
              <Image source={require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            )}
          </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join ApexConnect today</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DISPLAY NAME</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}><UserPlus size={20} color="#9CA3AF" /></View>
                <TextInput
                  style={styles.insetInput}
                  placeholder="John Doe"
                  placeholderTextColor="#9CA3AF"
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={30}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}><Mail size={20} color="#9CA3AF" /></View>
                <TextInput
                  style={styles.insetInput}
                  placeholder="johndoe123"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}><Lock size={20} color="#9CA3AF" /></View>
                <TextInput
                  style={styles.insetInput}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showCreatePassword}
                />
                <TouchableOpacity 
                  style={styles.eyeContainer} 
                  onPress={() => setShowCreatePassword(!showCreatePassword)}
                >
                  {showCreatePassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
                </TouchableOpacity>
              </View>
              <Text style={styles.noteText}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateAccount} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="white" /> : (
                <>
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <ArrowRight size={18} color="white" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={{ color: '#A1A1AA', fontSize: 14 }}>Already have an account? </Text>
              <TouchableOpacity onPress={() => setStep('signin')}>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {step === 'backup' && (
        <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={styles.glassCard}>
          <View style={{ alignItems: 'center', marginBottom: 24, overflow: 'hidden', width: 96, height: 96 }}>
            {Platform.OS === 'web' ? (
              <img 
                src={((require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png') as any).uri) || require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                alt="Logo"
              />
            ) : (
              <Image source={require('../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            )}
          </View>
            <Text style={styles.title}>Backup Phrase</Text>
            <Text style={styles.warning}>IMPORTANT: Save this securely!</Text>

            <View style={styles.mnemonicContainer}>
              <View style={styles.mnemonicGrid}>
                {mnemonic.map((word, index) => (
                  <View key={index} style={styles.mnemonicWord}>
                    <Text style={styles.mnemonicNumber}>{index + 1}.</Text>
                    <Text style={styles.mnemonicText}>{word}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={copyMnemonic}>
                {copied ? <Check size={20} color="#10B981" /> : <Copy size={20} color="#9CA3AF" />}
                <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy to clipboard'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', marginBottom: 24 }}>
              <Text style={[styles.inputLabel, { marginBottom: 8, marginLeft: 0 }]}>YOUR ACCOUNT ID</Text>

              <View style={styles.accountIdBox}>
                <Text style={styles.accountIdText}>{userId}</Text>
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={async () => {
                await Clipboard.setStringAsync(userId || '');
                toast.success('Account ID copied to clipboard');
              }}>
                <Copy size={20} color="#9CA3AF" />
                <Text style={styles.copyButtonText}>Copy ID</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setHasConfirmedBackup(!hasConfirmedBackup)}>
              <View style={[styles.checkbox, hasConfirmedBackup && styles.checkboxChecked]}>
                {hasConfirmedBackup && <Check size={16} color="white" />}
              </View>
              <Text style={styles.checkboxLabel}>I have saved my backup phrase</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.primaryBtn, !hasConfirmedBackup && { opacity: 0.5 }]} onPress={handleConfirmBackup} disabled={!hasConfirmedBackup}>
              <Text style={styles.primaryBtnText}>Continue to Chat</Text>
              <ArrowRight size={18} color="white" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // slate-50
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    width: 0,
    height: 0,
    display: 'none',
  },
  glassCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF', // white
    borderColor: '#F3F4F6',     // gray-100
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 40,
    alignItems: 'center',
    marginVertical: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 5,
  },
  webGlassEffect: {}, // Removed glass effect completely
  brandText: {
    fontSize: 36,
    fontWeight: '800',
    fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: -1,
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
  },
  webBrandGradient: {
    color: '#2563EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700', // bold
    color: '#111827', // gray-900
    marginBottom: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280', // gray-500
    marginBottom: 32,
    textAlign: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280', // gray-500
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB', // blue-600
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  eyeContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  insetInput: {
    width: '100%',
    height: 52,
    backgroundColor: '#F9FAFB', // gray-50
    borderWidth: 1,
    borderColor: '#E5E7EB', // gray-200
    borderRadius: 12,
    color: '#111827', // gray-900
    paddingLeft: 48,
    paddingRight: 48,
    fontSize: 16,
  },
  noteText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    marginLeft: 4,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#2563EB', // blue-600
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: 32,
    alignItems: 'center',
  },
  footerLink: {
    color: '#2563EB', // blue-600
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  warning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 24,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  mnemonicContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB', // gray-50
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB', // gray-200
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  mnemonicWord: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    paddingVertical: 6,
  },
  mnemonicNumber: {
    fontSize: 12,
    color: '#9CA3AF', // gray-400
    fontWeight: '600',
    marginRight: 8,
  },
  mnemonicText: {
    fontSize: 16,
    color: '#111827', // gray-900
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#6B7280', // gray-500
    fontWeight: '500',
  },
  accountIdBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accountIdText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB', // gray-300
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563', // gray-600
  },
});
