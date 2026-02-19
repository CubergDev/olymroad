import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.olymroad.app',
	appName: 'Olymroad',
	webDir: 'build',
	// API URL is configured via PUBLIC_API_URL in the web bundle.
	// Keep local web assets for mobile and call backend over network.
	server: {
		cleartext: true
	}
};

export default config;
