import { TouchableOpacity, Text } from 'react-native';

export interface ChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

export const Chip = ({ label, isSelected, onPress }: ChipProps) => {
  const activeClass =
    'px-4 py-2 flex-row items-center justify-center rounded-full mr-2 mb-3 border bg-blue-50 border-blue-500';
  const inactiveClass =
    'px-4 py-2 flex-row items-center justify-center rounded-full mr-2 mb-3 border bg-white border-gray-200';

  return (
    <TouchableOpacity onPress={onPress} className={isSelected ? activeClass : inactiveClass}>
      <Text className={isSelected ? 'font-bold text-blue-600' : 'font-medium text-gray-600'}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
