import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-2rem)]">
      <h1 className="text-4xl font-bold mb-4">Welcome to AI Playcaller</h1>
      <p className="text-lg text-gray-600 mb-8">
        Get started by configuring your terminology.
      </p>
    </div>
  );
}
