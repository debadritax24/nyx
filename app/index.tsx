import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useVaultStore } from '../src/store/vaultStore';
import { SplashScreen } from '../src/components/SplashScreen';
import { OnboardingScreen } from '../src/components/OnboardingScreen';

const ONBOARDING_KEY = 'nyx_onboarding_completed_v1';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { isUnlocked, loadFromLocalKeystore } = useVaultStore();

  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkState = async () => {
      // Check if user has already seen onboarding
      let hasCompleted = false;
      try {
        const SecureStore = require('expo-secure-store');
        const stored = await SecureStore.getItemAsync(ONBOARDING_KEY);
        hasCompleted = stored === 'true';
      } catch {
        // Fallback for web or memory
        if (typeof window !== 'undefined' && window.localStorage) {
          hasCompleted = window.localStorage.getItem(ONBOARDING_KEY) === 'true';
        }
      }

      setCheckingOnboarding(false);

      if (isLoading) return;

      if (isAuthenticated) {
        if (!isUnlocked) {
          await loadFromLocalKeystore();
        }
        router.replace('/(app)');
      } else {
        if (hasCompleted) {
          router.replace('/(auth)/login');
        } else {
          setShowOnboarding(true);
        }
      }
    };

    checkState();
  }, [isAuthenticated, isLoading, isUnlocked, router, loadFromLocalKeystore]);

  const markOnboardingDone = async () => {
    try {
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    } catch {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ONBOARDING_KEY, 'true');
      }
    }
  };

  const handleGetStarted = async () => {
    await markOnboardingDone();
    router.replace('/(auth)/register');
  };

  const handleSignIn = async () => {
    await markOnboardingDone();
    router.replace('/(auth)/login');
  };

  // 1. App initialization / splash screen
  if (isLoading || checkingOnboarding) {
    return <SplashScreen />;
  }

  // 2. Onboarding for new mobile users
  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={handleGetStarted}
        onSignIn={handleSignIn}
      />
    );
  }

  return <SplashScreen />;
}
