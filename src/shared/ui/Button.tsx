import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  icon,
}: ButtonProps) => {
  const getVariantStyles = () => {
    if (disabled) return 'bg-gray-200';
    switch (variant) {
      case 'primary':
        return 'bg-blue-600';
      case 'secondary':
        return 'bg-gray-900';
      case 'outline':
        return 'bg-transparent border border-gray-200';
      case 'ghost':
        return 'bg-transparent';
      default:
        return 'bg-blue-600';
    }
  };

  const getTextStyles = () => {
    if (disabled) return 'text-gray-400';
    switch (variant) {
      case 'outline':
      case 'ghost':
        return 'text-gray-900';
      default:
        return 'text-white';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      className={`h-16 w-full flex-row items-center justify-center rounded-2xl px-4 ${getVariantStyles()}`}>
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' ? '#111827' : '#FFFFFF'} />
      ) : (
        <View className="flex-row items-center">
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={`text-lg font-bold ${getTextStyles()}`}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
