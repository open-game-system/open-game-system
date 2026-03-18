import type React from "react";

interface OGSSmallLogoProps {
  className?: string;
}

const OGSSmallLogo: React.FC<OGSSmallLogoProps> = ({ className = "" }) => {
  return <img src="/logo.svg" alt="Open Game System Logo Icon" className={className} />;
};

export default OGSSmallLogo;
