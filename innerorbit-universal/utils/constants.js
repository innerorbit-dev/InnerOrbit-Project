/**
 * Purpose: Centralized repository for application-wide static data, including privacy level
 * definitions, emergency protocols, and onboarding documentation content.
 */
export const LEVELS = [
  { id: 0, title: "Normal Chat", desc: "Standard messaging mode with end-to-end encryption." },
  { id: 1, title: "Private Language", desc: "Reverses text direction to keep messages private from bystanders." },
  { id: 2, title: "Camouflage Mode", desc: "Hides your real conversations behind a decoy interface." },
  { id: 3, title: "Auto Safety", desc: "Automatically secures your screen when potential risk is detected." },
];

export const EMERGENCY_LEVEL = { id: 99, title: "Emergency", desc: "Immediate Lockdown & Data Protection Protocols." };

export const APP_DOCS = [
  {
    id: 'intro',
    title: 'About InnerOrbit',
    content: 'InnerOrbit is a secure communication platform designed with privacy first.'
  },
  {
    id: 'privacy',
    title: 'Privacy Features',
    content: 'We use end-to-end encryption and stealth modes to protect your data.'
  },
  {
    id: 'stealth',
    title: 'Stealth Mode',
    content: 'Access hidden chats using the calculator interface and your secret PIN.'
  }
];
