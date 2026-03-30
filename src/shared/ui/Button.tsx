import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  isLoading?: boolean;
}

export const Button = ({ label, onPress, variant = 'primary', isLoading = false }: ButtonProps) => {
  const baseClasses = 'w-full py-4 rounded-2xl flex-row justify-center items-center';

  const variantClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-white border border-gray-200',
    outline: 'bg-white border border-gray-200',
  };

  const textClasses = {
    primary: 'text-white font-bold text-lg',
    secondary: 'text-gray-800 font-bold text-lg',
    outline: 'text-gray-800 font-semibold text-lg',
  };

  return (
    <TouchableOpacity
      className={`${baseClasses} ${variantClasses[variant]}`}
      onPress={onPress}
      disabled={isLoading}>
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? 'white' : 'black'} />
      ) : (
        <Text className={textClasses[variant]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};
