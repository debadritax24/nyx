import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';
import { ShieldIcon, SearchIcon, SettingsIcon } from './Icons';
import { Typography, Radius, Shadows } from './tokens';

export type NavTab = 'home' | 'search' | 'settings';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  accountsCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  accountsCount,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        Shadows.card,
      ]}
    >
      {/* Home Tab */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange && onTabChange('home')}
        style={styles.tabItem}
        accessibilityRole="tab"
        accessibilityLabel="Authenticator Home"
        accessibilityState={{ selected: activeTab === 'home' }}
      >
        <View
          style={[
            styles.iconBox,
            activeTab === 'home' && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <ShieldIcon
            size={18}
            color={activeTab === 'home' ? theme.primaryText : theme.textMuted}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeTab === 'home' ? theme.primary : theme.textMuted,
              fontWeight: activeTab === 'home' ? '700' : '500',
            },
          ]}
        >
          Vault
        </Text>
      </TouchableOpacity>

      {/* Search Tab */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange && onTabChange('search')}
        style={styles.tabItem}
        accessibilityRole="tab"
        accessibilityLabel="Search accounts"
        accessibilityState={{ selected: activeTab === 'search' }}
      >
        <View
          style={[
            styles.iconBox,
            activeTab === 'search' && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <SearchIcon
            size={18}
            color={activeTab === 'search' ? theme.primaryText : theme.textMuted}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeTab === 'search' ? theme.primary : theme.textMuted,
              fontWeight: activeTab === 'search' ? '700' : '500',
            },
          ]}
        >
          Search {accountsCount !== undefined && accountsCount > 0 ? `(${accountsCount})` : ''}
        </Text>
      </TouchableOpacity>

      {/* Settings Tab */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange && onTabChange('settings')}
        style={styles.tabItem}
        accessibilityRole="tab"
        accessibilityLabel="Settings"
        accessibilityState={{ selected: activeTab === 'settings' }}
      >
        <View
          style={[
            styles.iconBox,
            activeTab === 'settings' && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <SettingsIcon
            size={18}
            color={activeTab === 'settings' ? theme.primaryText : theme.textMuted}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeTab === 'settings' ? theme.primary : theme.textMuted,
              fontWeight: activeTab === 'settings' ? '700' : '500',
            },
          ]}
        >
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Typography.fontFamilyBody,
    letterSpacing: 0.2,
  },
});
