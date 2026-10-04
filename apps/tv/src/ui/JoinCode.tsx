/** The couch corner: how someone who isn't on the couch yet gets on (the TV code). */
export function JoinCode({ code }: { code: string }) {
  return (
    <div className="join-code" data-testid="join-code">
      <span className="join-code-line">Join from your phone</span>
      <span className="join-code-value">{code}</span>
    </div>
  );
}
