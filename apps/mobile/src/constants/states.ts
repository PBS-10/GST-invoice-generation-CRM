export const GST_STATE_CODES = [
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '29', name: 'Karnataka' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '27', name: 'Maharashtra' },
  { code: '07', name: 'Delhi' },
  { code: '24', name: 'Gujarat' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '19', name: 'West Bengal' },
] as const;

export function stateLabel(code: string | null | undefined): string {
  if (!code) {
    return 'Same as shop';
  }
  const match = GST_STATE_CODES.find((state) => state.code === code);
  return match ? `${match.name} (${code})` : code;
}

/** Options for pickers; the description lets people search by GST state code. */
export const GST_STATE_OPTIONS = GST_STATE_CODES.map((state) => ({
  value: state.code as string,
  label: state.name as string,
  description: `State code ${state.code}`,
}));
