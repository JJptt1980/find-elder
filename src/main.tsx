import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { installAudioUnlock } from './radar/radarSound';
import { startGps } from './sensors/gps';
import './ui/theme.css';
import { installFakeGps } from './dev/fakeGps';

if (import.meta.env.DEV) installFakeGps();

render(<App />, document.getElementById('app')!);

registerSW({ immediate: true });
startGps();
installAudioUnlock();
