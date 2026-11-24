import React from 'react';
import { View, Text, Platform, ViewStyle } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

function WebSvg({
  children,
  size = 20,
  viewBox = '0 0 24 24',
  color = 'currentColor',
  style,
}: {
  children: React.ReactNode;
  size?: number;
  viewBox?: string;
  color?: string;
  style?: any;
}) {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox,
        fill: 'none',
        stroke: color,
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', ...style },
      },
      children
    );
  }
  return null;
}

export const SunIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('circle', { cx: 12, cy: 12, r: 4 })}
        {React.createElement('path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>☀</Text>
    </View>
  );
};

export const MoonIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>☾</Text>
    </View>
  );
};

export const ShieldIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.8, color, lineHeight: size }}>🛡</Text>
    </View>
  );
};

export const LockIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('rect', { width: 18, height: 11, x: 3, y: 11, rx: 2, ry: 2 })}
        {React.createElement('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>🔒</Text>
    </View>
  );
};

export const KeyIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4' })}
        {React.createElement('path', { d: 'm21 2-9.6 9.6' })}
        {React.createElement('circle', { cx: 7.5, cy: 15.5, r: 5.5 })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⚿</Text>
    </View>
  );
};

export const CopyIcon: React.FC<IconProps> = ({ size = 18, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('rect', { width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 })}
        {React.createElement('path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>📋</Text>
    </View>
  );
};

export const CheckIcon: React.FC<IconProps> = ({ size = 18, color = '#2E7D32', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M20 6 9 17l-5-5' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size, fontWeight: '700' }}>✓</Text>
    </View>
  );
};

export const TrashIcon: React.FC<IconProps> = ({ size = 18, color = '#991B1B', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>✕</Text>
    </View>
  );
};

export const SearchIcon: React.FC<IconProps> = ({ size = 18, color = '#907B76', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('circle', { cx: 11, cy: 11, r: 8 })}
        {React.createElement('path', { d: 'm21 21-4.3-4.3' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⌕</Text>
    </View>
  );
};

export const PlusIcon: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M5 12h14M12 5v14' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.9, color, lineHeight: size, fontWeight: '700' }}>+</Text>
    </View>
  );
};

export const QrCodeIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('rect', { width: 5, height: 5, x: 3, y: 3, rx: 1 })}
        {React.createElement('rect', { width: 5, height: 5, x: 16, y: 3, rx: 1 })}
        {React.createElement('rect', { width: 5, height: 5, x: 3, y: 16, rx: 1 })}
        {React.createElement('path', { d: 'M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⊡</Text>
    </View>
  );
};

export const UploadIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>↑</Text>
    </View>
  );
};

export const EyeIcon: React.FC<IconProps> = ({ size = 20, color = '#907B76', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' })}
        {React.createElement('circle', { cx: 12, cy: 12, r: 3 })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>👁</Text>
    </View>
  );
};

export const EyeOffIcon: React.FC<IconProps> = ({ size = 20, color = '#907B76', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⊘</Text>
    </View>
  );
};

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' })}
        {React.createElement('circle', { cx: 12, cy: 12, r: 3 })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⚙</Text>
    </View>
  );
};

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 18, color = '#907B76', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'm15 18-6-6 6-6' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>‹</Text>
    </View>
  );
};

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 18, color = '#907B76', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'm9 18 6-6-6-6' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>›</Text>
    </View>
  );
};

export const DeviceIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('rect', { width: 14, height: 20, x: 5, y: 2, rx: 2, ry: 2 })}
        {React.createElement('path', { d: 'M12 18h.01' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>📱</Text>
    </View>
  );
};

export const RefreshIcon: React.FC<IconProps> = ({ size = 18, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⟳</Text>
    </View>
  );
};

export const MoreIcon: React.FC<IconProps> = ({ size = 20, color = '#907B76', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('circle', { cx: 12, cy: 12, r: 1 })}
        {React.createElement('circle', { cx: 19, cy: 12, r: 1 })}
        {React.createElement('circle', { cx: 5, cy: 12, r: 1 })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⋯</Text>
    </View>
  );
};

export const TorchIcon: React.FC<IconProps & { active?: boolean }> = ({
  size = 20,
  color = '#382528',
  active = false,
  style,
}) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M18 6c0 2-2 4-2 7v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6c0-3-2-5-2-7 0-3 3-4 6-4s6 1 6 4z' })}
        {active && React.createElement('path', { d: 'M12 2v2M4 4l2 2M20 4l-2 2' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>{active ? '⚡' : '🔦'}</Text>
    </View>
  );
};

export const HomeIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' })}
        {React.createElement('polyline', { points: '9 22 9 12 15 12 15 22' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>⌂</Text>
    </View>
  );
};

export const EditIcon: React.FC<IconProps> = ({ size = 18, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>✎</Text>
    </View>
  );
};

export const UserIcon: React.FC<IconProps> = ({ size = 20, color = '#382528', style }) => {
  if (Platform.OS === 'web') {
    return (
      <WebSvg size={size} color={color} style={style}>
        {React.createElement('path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' })}
        {React.createElement('circle', { cx: 12, cy: 7, r: 4 })}
      </WebSvg>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>👤</Text>
    </View>
  );
};
