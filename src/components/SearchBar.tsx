import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../store/themeStore';
import { SearchIcon } from './Icons';
import { Radius, Spacing, Typography } from './tokens';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  count?: number;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search by service or account email...',
  count,
  autoFocus = false,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.inputBackground,
          borderColor: theme.inputBorder,
        },
      ]}
    >
      <SearchIcon size={18} color={theme.textMuted} style={styles.searchIcon} />

      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.textDim}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search accounts"
        style={[
          styles.input,
          {
            color: theme.text,
            fontFamily: Typography.fontFamilyBody,
          },
        ]}
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            onChangeText('');
            onClear && onClear();
          }}
          style={styles.clearBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.clearText, { color: theme.textMuted }]}>✕</Text>
        </TouchableOpacity>
      )}

      {count !== undefined && (
        <View style={[styles.countBadge, { backgroundColor: theme.surfaceHighlight }]}>
          <Text style={[styles.countText, { color: theme.secondaryText }]}>{count}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },
  clearBtn: {
    padding: 4,
    marginRight: 4,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
