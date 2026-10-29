/** Incoming signals collected into one clear centre. */
export function FormaMark({ size = 26 }: { size?: number }) {
 return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
  <path d="M3 16h6M23 4l-3 5M23 28l-3-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  <path d="M7 7a13 13 0 0 0 0 18M13 3a13 13 0 0 1 15 9M28 20a13 13 0 0 1-15 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  <circle cx="16" cy="16" r="3.5" fill="currentColor"/>
 </svg>;
}
