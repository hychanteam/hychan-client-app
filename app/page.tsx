import Link from "next/link"
import { FaXTwitter, FaDiscord } from 'react-icons/fa6';
import Image from "next/image"

export default function Home() {
  return (
    <main className="min-h-screen bg-teal-800 text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/images/png/landing-background.png"
          alt="landing-background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-teal-800/50" />
      </div>

      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col relative z-10">
        <header className="flex justify-center md:justify-between items-center h-12">
          <div className="w-32 md:w-40">
            <Image
              src="/assets/images/png/title.png"
              alt="HYCHAN"
              width={160}
              height={48}
              priority
            />
          </div>

          <button className="hidden md:block bg-transparent border border-white/30 text-white py-2 px-6 rounded-[8px] hover:bg-white/10 transition-colors">
            Connecting Soon
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center relative mt-16 md:mt-0">
          <h2 className="text-4xl md:text-5xl mb-4 md:mb-6">
            We Are
            <div className="text-4xl md:text-7xl font-bold tracking-wider mt-2">
              <Image
                src="/assets/images/png/title-large.png"
                alt="HYCHAN"
                width={200} // Smaller width for mobile
                height={60}
                className="mx-auto md:w-[300px] md:h-[90px]"
              />
            </div>
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 mt-0">
            <Link href="/mint">
              <button className="bg-teal-400 hover:bg-teal-300 text-white py-3 px-12 rounded-md text-2xl font-medium tracking-wider transition-colors">
                Enter The Arena
              </button>
            </Link>

            <Link href="/check-wallet">
              <button className="bg-transparent border border-white/30 hover:bg-white/10 text-white py-3 px-12 rounded-md text-2xl font-medium tracking-wider transition-colors">
                Check Wallet
              </button>
            </Link>
          </div>

          <div className="mt-12 space-y-2">
            <p className="text-2xl text-teal-300 opacity-80">we advise you to be liquid</p>
          </div>

          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-lg leading-relaxed">
            The first anime NFT on Hyperliquid.<br/> 
            Cyber waifus, zero patience, 100% degen. 
            You either get in early or cry later. Just dominance.
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-auto mb-8">
          <Link href="https://x.com/hychanhl" target="_blank" className="border border-white/30 p-3 rounded-md hover:bg-white/10 transition-colors">
            <FaXTwitter size={24} />
          </Link>
          <Link href="https://discord.gg/hychanhl" className="border border-white/30 p-3 rounded-md hover:bg-white/10 transition-colors">
            <FaDiscord size={24} />
          </Link>
        </div>
      </div>
    </main>
  )
}

