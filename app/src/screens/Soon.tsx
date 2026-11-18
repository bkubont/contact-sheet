export function Soon({ title, heading, text }: { title: string; heading: string; text: string }) {
  return (
    <>
      <header className="screen-head"><div className="head-row"><h1 className="title">{title}</h1></div></header>
      <div className="body">
        <div className="soon"><h3>{heading}</h3><p>{text}</p></div>
      </div>
    </>
  );
}
