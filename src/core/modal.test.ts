import { DIALOG_MAX_WIDTH, defaultModalAnimation, dialogWidth, modalProps } from './modal';

describe('modal helpers', () => {
  it('picks the default animation of each presentation', () => {
    expect(defaultModalAnimation()).toBe('scale');
    expect(defaultModalAnimation('fullScreen')).toBe('slide');
  });

  it('accepts React Native Modal names as fallbacks', () => {
    const onRequestClose = jest.fn();
    const props = modalProps({ visible: true, onRequestClose, animationType: 'fade' });
    expect(props.open).toBe(true);
    expect(props.animation).toBe('fade');
    props.onOpenChange?.(false);
    expect(onRequestClose).toHaveBeenCalledWith();

    const onOpenChange = jest.fn();
    expect(modalProps({ open: false, visible: true, onOpenChange, presentation: 'fullScreen' })).toEqual({
      open: false,
      onOpenChange,
      animation: 'slide',
    });
  });

  it('sizes dialogs to the screen minus the margins', () => {
    expect(dialogWidth(1000)).toBe(DIALOG_MAX_WIDTH);
    expect(dialogWidth(360)).toBe(312);
    expect(dialogWidth(1000, 600)).toBe(600);
    expect(dialogWidth(20)).toBe(0);
  });
});
