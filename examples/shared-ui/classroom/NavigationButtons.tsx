import { engine } from 'omnistyle';
import { Button, ButtonLabel } from '../ui';

const Buttons = engine('Box', ({ theme }) => ({
  flexDirection: 'row',
  gap: theme.spacing.sm,
}));

interface NavigationButtonsProps {
  onPrevious?: () => void;
  onNext?: () => void;
}

/** "Anterior" e "Próxima": cada botão só aparece quando existe para onde ir. */
export function NavigationButtons({ onPrevious, onNext }: NavigationButtonsProps) {
  return (
    <Buttons>
      {onPrevious ? (
        <Button size="sm" outlined onPress={onPrevious} testID="previous">
          <ButtonLabel outlined>← Anterior</ButtonLabel>
        </Button>
      ) : null}
      {onNext ? (
        <Button size="sm" onPress={onNext} testID="next">
          <ButtonLabel>Próxima →</ButtonLabel>
        </Button>
      ) : null}
    </Buttons>
  );
}
