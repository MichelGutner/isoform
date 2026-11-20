/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { withPlaylist } from './withPlaylist';

const Player = React.forwardRef<any, any>((props, _ref) => (
  <div data-testid="player" data-src={props.src ?? ''} data-has-items={String('items' in props)} />
));

const Listed = withPlaylist('Video', Player);

describe('withPlaylist (web)', () => {
  it('renders the plain player right away when there is no list (no playlist chunk needed)', () => {
    render(<Listed src="a.mp4" />);
    const player = screen.getByTestId('player');
    expect(player.getAttribute('data-src')).toBe('a.mp4');
  });

  it('strips the list props before they reach the plain player', () => {
    render(<Listed src="a.mp4" items={[]} carousel autoAdvance />);
    expect(screen.getByTestId('player').getAttribute('data-has-items')).toBe('false');
  });

  it('loads the playlist on demand when given items, then shows the current entry in the player', async () => {
    render(<Listed items={[{ src: 'one.mp4' }, { src: 'two.mp4' }]} />);
    const player = await screen.findByTestId('player');
    expect(player.getAttribute('data-src')).toBe('one.mp4');
  });
});
