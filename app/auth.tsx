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
  Image,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Copy, Check, Shield, UserPlus, Key, Phone, MessageCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '@/store/authStore';

const isValidPassword = (pwd: string) => {
  // Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return re.test(pwd);
};

export default function AuthScreen() {
  const router = useRouter();
  const { createAccount, signIn, isLoading, isAuthenticated, theme } = useAuthStore();
  const [step, setStep] = useState<'create' | 'backup' | 'signin'>('signin');
  const isDark = theme === 'dark';

  // Theme-based colors
  const bgColor = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const cardBg = isDark ? '#202C33' : '#FFFFFF';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';
  const brandColor = isDark ? '#00A884' : '#25D366';
  const linkColor = isDark ? '#53BDEB' : '#027EB5';

  // Create Account State
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Sign In State
  const [signinUsername, setSigninUsername] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  // Backup State
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasConfirmedBackup, setHasConfirmedBackup] = useState(false);

  // If already authenticated, go straight to tabs
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const handleCreateAccount = async () => {
    if (!displayName.trim() || !username.trim() || !password) {
      Alert.alert('Error', 'Please fill out all fields');
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 8 characters long, and include an uppercase letter, a lowercase letter, a number, and a special character.'
      );
      return;
    }

    try {
      const generatedMnemonic = useAuthStore.getState().generateMnemonic();
      setMnemonic(generatedMnemonic.split(' '));
      await createAccount(displayName.trim(), username.trim(), password);
      setStep('backup');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create account. Username might be taken.');
    }
  };

  const handleSignIn = async () => {
    if (!signinUsername.trim() || !signinPassword) {
      Alert.alert('Error', 'Please enter your username and password');
      return;
    }

    try {
      await signIn(signinUsername.trim(), signinPassword);
      const user = useAuthStore.getState().user;
      Alert.alert('Welcome Back!', `Welcome back, ${user?.display_name}!`);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Error', 'Invalid username or password.');
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
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {step === 'create' && (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={[Platform.OS === 'web' ? styles.webContainerCard : styles.content, { backgroundColor: Platform.OS === 'web' ? cardBg : undefined }]}>
            {Platform.OS === 'web' ? (
              <img 
                src={((require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg') as any).uri) || require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} 
                style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 16, objectFit: 'contain' }} 
                alt="Logo"
              />
            ) : (
              <Image
                source={require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')}
                style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 16 }}
              />
            )}
            <Text style={[styles.title, { color: textColor }]}>Create Your Account</Text>
            <Text style={[styles.subtitle, { color: subTextColor }]}>Fill in your details below</Text>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor: borderColor }]}
                placeholder="Enter your name"
                placeholderTextColor={subTextColor}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={30}
              />
              <Text style={[styles.note, { color: subTextColor }]}>This is how others will see you in chats</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Username</Text>
              <TextInput
                style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor: borderColor }]}
                placeholder="Choose a unique username"
                placeholderTextColor={subTextColor}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor: borderColor }]}
                placeholder="Enter a strong password"
                placeholderTextColor={subTextColor}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Text style={[styles.note, { color: subTextColor }]}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateAccount}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Creating...' : 'Continue'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('signin')}
            >
              <Text style={[styles.backButtonText, { color: subTextColor }]}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {step === 'backup' && (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={[Platform.OS === 'web' ? styles.webContainerCard : styles.content, { backgroundColor: Platform.OS === 'web' ? cardBg : undefined }]}>
            {Platform.OS === 'web' ? (
              <img 
                src={((require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg') as any).uri) || require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} 
                style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 16, objectFit: 'contain' }} 
                alt="Logo"
              />
            ) : (
              <Image
                source={require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')}
                style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 16 }}
              />
            )}
            <Text style={[styles.title, { color: textColor }]}>Backup Your Account</Text>
            <Text style={styles.warning}>IMPORTANT: Save this phrase securely!</Text>

            <View style={[styles.mnemonicContainer, { backgroundColor: isDark ? '#451A03' : '#FEF3C7' }]}>
              <View style={styles.mnemonicGrid}>
                {mnemonic.map((word, index) => (
                  <View key={index} style={styles.mnemonicWord}>
                    <Text style={styles.mnemonicNumber}>{index + 1}.</Text>
                    <Text style={styles.mnemonicText}>{word}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: cardBg, borderColor: borderColor }]}
                onPress={copyMnemonic}
              >
                {copied ? <Check size={20} color="#10B981" /> : <Copy size={20} color={subTextColor} />}
                <Text style={[styles.copyButtonText, { color: textColor }]}>
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.accountIdContainer}>
              <Text style={[styles.label, { color: textColor }]}>Your Internal Account ID</Text>
              <View style={[styles.accountIdBox, { backgroundColor: cardBg, borderColor: borderColor }]}>
                <Text style={[styles.accountIdText, { color: textColor }]}>{userId}</Text>
              </View>
              <Text style={[styles.note, { color: subTextColor }]}>Used for adding contacts</Text>
              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: cardBg, borderColor: borderColor }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(userId || '');
                  Alert.alert('Copied', 'Account ID copied to clipboard');
                }}
              >
                <Copy size={20} color={subTextColor} />
                <Text style={[styles.copyButtonText, { color: textColor }]}>Copy ID</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setHasConfirmedBackup(!hasConfirmedBackup)}
            >
              <View style={[styles.checkbox, hasConfirmedBackup && styles.checkboxChecked, !hasConfirmedBackup && { borderColor: borderColor, backgroundColor: cardBg }]}>
                {hasConfirmedBackup && <Check size={16} color="white" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: textColor }]}>
                I have saved my backup phrase securely
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, !hasConfirmedBackup && styles.buttonDisabled]}
              onPress={handleConfirmBackup}
              disabled={!hasConfirmedBackup}
            >
              <Text style={styles.primaryButtonText}>Continue to Chat</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {step === 'signin' && (
        <View style={[Platform.OS === 'web' ? styles.webContainerCard : styles.content, { backgroundColor: Platform.OS === 'web' ? cardBg : undefined }]}>
          {Platform.OS === 'web' ? (
            <img 
              src={((require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg') as any).uri) || require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} 
              style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 16, objectFit: 'contain' }} 
              alt="Logo"
            />
          ) : (
            <Image
              source={require('../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')}
              style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 16 }}
            />
          )}
          <Text style={[styles.title, { color: textColor }]}>Sign In</Text>
          <Text style={[styles.subtitle, { color: subTextColor }]}>Enter your credentials to continue</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: textColor }]}>Username</Text>
            <TextInput
              style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor: borderColor }]}
              placeholder="Username"
              placeholderTextColor={subTextColor}
              value={signinUsername}
              onChangeText={setSigninUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: textColor }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor: borderColor }]}
              placeholder="Password"
              placeholderTextColor={subTextColor}
              value={signinPassword}
              onChangeText={setSigninPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('create')}
          >
            <Text style={[styles.backButtonText, { color: subTextColor }]}>Don't have an account? Create one</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  webContainerCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
    marginVertical: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 32,
  },
  warning: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  note: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 56,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 56,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  mnemonicContainer: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
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
    color: '#92400E',
    fontWeight: '600',
    marginRight: 4,
    width: 24,
  },
  mnemonicText: {
    fontSize: 16,
    color: '#78350F',
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#666',
  },
  accountIdContainer: {
    width: '100%',
    marginBottom: 24,
  },
  accountIdBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  accountIdText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
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
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  whatsappWelcomeContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  whatsappTitle: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 40,
  },
  whatsappLogoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappLogoBg: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappTermsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  whatsappAgreeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  whatsappAgreeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  devOptionsButton: {
    padding: 10,
  },
  whatsappContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  whatsappHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  whatsappSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  whatsappPhoneInputContainer: {
    flexDirection: 'row',
    width: '80%',
    alignItems: 'center',
    gap: 16,
  },
  whatsappCountryCode: {
    borderBottomWidth: 2,
    paddingBottom: 8,
    width: 60,
    alignItems: 'center',
  },
  whatsappInputText: {
    fontSize: 18,
  },
  whatsappPhoneInput: {
    flex: 1,
    borderBottomWidth: 2,
    paddingBottom: 8,
    fontSize: 18,
    letterSpacing: 1,
  },
  whatsappActionContainer: {
    marginTop: 'auto',
    marginBottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  whatsappNextButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  whatsappNextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  whatsappOtpInputContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
  },
  whatsappOtpInput: {
    width: 160,
    borderBottomWidth: 2,
    paddingBottom: 8,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
  },
  whatsappOtpHint: {
    fontSize: 14,
    marginTop: 16,
  },
});
