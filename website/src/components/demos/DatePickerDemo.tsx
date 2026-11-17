import './setup';
import { useState } from 'react';
import { engine } from '@michelgutner/isoform';
import { Caption, Stack } from './kit';

const Picker = engine('DatePicker', ({ theme }) => ({
  alignSelf: 'flex-start',
  padding: 8,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  color: theme.color.text,
}));

const today = new Date();
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

export default function DatePickerDemo() {
  const [date, setDate] = useState(today);
  return (
    <Stack>
      <Picker value={date} onValueChange={setDate} mode="date" minimumDate={today} maximumDate={nextMonth} label="Delivery date" />
      <Picker value={date} onValueChange={setDate} mode="time" label="Delivery time" />
      <Caption>{date.toLocaleString()}</Caption>
    </Stack>
  );
}
