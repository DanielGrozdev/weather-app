import Logo from "../assets/logo.svg";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <img
        src={Logo}
        alt="Breezy"
        className="h-24 select-none splash-breathe"
        draggable={false}
      />
    </div>
  );
}
