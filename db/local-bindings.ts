// Preserve the existing secure DB identity and state. This second ID is local only.
export function localD1Bindings(secureBinding: string | null, command: string) {
  if (secureBinding === 'LAB_DB') {
    throw new Error('The secure database binding must not be named LAB_DB.');
  }
  return [
    ...(secureBinding ? [{
      binding: secureBinding,
      database_name: 'site-creator-d1',
      database_id: '00000000-0000-4000-8000-000000000000',
    }] : []),
    ...(command === 'serve' ? [{
      binding: 'LAB_DB',
      database_name: 'operation-secure-login-attack-lab-local',
      database_id: '00000000-0000-4000-8000-000000000001',
    }] : []),
  ];
}
