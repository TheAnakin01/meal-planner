// Re-mounts on every navigation, so each page gently fades in (off when reduced motion is on).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col motion-safe:animate-page-in">{children}</div>;
}
