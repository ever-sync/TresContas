import logoIcon from '../assets/logo-icon.svg';
import arrowRight from '../assets/arrow-right.svg';
import closeIcon from '../assets/close-icon.svg';
import sparkleIcon from '../assets/sparkle-icon.svg';
import heroBackground from '../assets/hero-background.png';
import heroShape from '../assets/hero-shape.svg';
import databitesLogo from '../assets/databites-logo.svg';
import marketsavyIcon from '../assets/marketsavy-icon.svg';
import bestbankLogo from '../assets/bestbank-logo.svg';
import bestbankIcon from '../assets/bestbank-icon.svg';

const HeroPage = () => {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Top Banner */}
      <div className="bg-(--color-banner-bg) px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 justify-center">
          <p className="text-sm text-white/75 font-[family-name:var(--font-satoshi)]">
            Lorem Ipsum has been the industry's standard dummy text ever
          </p>
          <button className="flex items-center gap-1 text-sm text-white font-medium font-[family-name:var(--font-satoshi)] hover:opacity-80 transition-opacity">
            Learn more
            <img src={arrowRight} alt="" className="w-1.5 h-2" />
          </button>
        </div>
        <button className="text-white hover:opacity-80 transition-opacity ml-4">
          <img src={closeIcon} alt="Close" className="w-3 h-3" />
        </button>
      </div>

      {/* Main Hero Section Container */}
      <div className="relative">
        {/* Background Image Container */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBackground})` }}
        />

        {/* Navigation Bar */}
        <div className="relative z-10">
          <div className="border-b border-white/20 backdrop-blur-[52px]">
            <div className="max-w-7xl mx-auto px-20 py-6 flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <img 
                  src={logoIcon} 
                  alt="Sylphic" 
                  className="w-6 h-6"
                  style={{
                    background: 'linear-gradient(41.27deg, #441b91 10.84%, #c490ff 66.27%, #4c0385 93.33%)'
                  }}
                />
                <span className="text-2xl font-medium text-white font-[family-name:var(--font-clash-display)]">
                  Sylphic
                </span>
              </div>

              {/* Center Navigation */}
              <nav className="flex items-center gap-7 px-6 py-3 rounded-[32px] border border-white/10 shadow-[0px_4px_4px_rgba(0,0,0,0.25)]"
                style={{
                  background: 'conic-gradient(from 9.33deg at 50% 50%, rgba(0,0,0,0) 172.66deg, #493582 281.25deg, rgba(71,47,140,0.4) 360deg)'
                }}
              >
                <a href="#" className="text-sm text-[#dfdfdf] hover:text-white transition-colors font-[family-name:var(--font-satoshi)]">
                  Home
                </a>
                <a href="#" className="text-sm text-[#dfdfdf] hover:text-white transition-colors font-[family-name:var(--font-satoshi)]">
                  About
                </a>
                <a href="#" className="text-sm text-[#dfdfdf] hover:text-white transition-colors font-[family-name:var(--font-satoshi)]">
                  Benerfits
                </a>
                <a href="#" className="text-sm text-[#dfdfdf] hover:text-white transition-colors font-[family-name:var(--font-satoshi)]">
                  Contact
                </a>
                <a href="#" className="text-sm text-[#dfdfdf] hover:text-white transition-colors font-[family-name:var(--font-satoshi)]">
                  Reviews
                </a>
              </nav>

              {/* Get Started Button */}
              <button 
                className="flex items-center gap-4 px-6 py-3 rounded-[48px] border border-white/10 hover:opacity-90 transition-opacity"
                style={{
                  background: 'conic-gradient(from 3.53deg at 50% 50%, rgba(0,0,0,0) 172.66deg, #493582 281.25deg, rgba(71,47,140,0.4) 360deg)'
                }}
              >
                <img src={sparkleIcon} alt="" className="w-5 h-5" />
                <span className="text-sm text-white font-[family-name:var(--font-satoshi)]">
                  Get Started
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 pt-32 pb-64">
          <h1 
            className="text-center text-[110px] font-normal capitalize leading-tight font-[family-name:var(--font-clash-display)]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,1) 2.39%, rgba(255,255,255,0.3) 91.52%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Empower Modern
            <br />
            Technology
          </h1>
        </div>

        {/* Hero Shape Overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <img src={heroShape} alt="" className="w-full h-auto" />
          
          {/* Down Arrow Button */}
          <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2">
            <button className="w-28 h-28 rounded-full bg-[#8b6dd6] border-4 border-white flex items-center justify-center hover:scale-105 transition-transform pointer-events-auto">
              <svg 
                className="w-8 h-16 text-white" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3" 
                viewBox="0 0 24 24"
              >
                <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Company Logos Section */}
      <div className="relative z-30 bg-white py-12">
        <div className="max-w-6xl mx-auto px-20 flex items-center justify-between">
          {/* NEXTFlowS */}
          <div 
            className="text-[26.46px] font-bold uppercase leading-[21.17px] font-[family-name:var(--font-clash-display)]"
            style={{
              background: 'linear-gradient(90deg, rgba(153,153,153,0) 8%, rgba(255,255,255,1) 70.5%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            NEXTFlowS
          </div>

          {/* dataBites Logo */}
          <img src={databitesLogo} alt="dataBites" className="h-10" />

          {/* MarketSavy */}
          <div className="flex items-center gap-2">
            <img src={marketsavyIcon} alt="" className="h-6 rounded-3xl" />
            <span className="text-[32px] font-bold text-white font-[family-name:var(--font-satoshi)] tracking-[-2px] leading-[28.8px]">
              MarketSavy
            </span>
          </div>

          {/* BestBank Logo (full) */}
          <img src={bestbankLogo} alt="BestBank" className="h-10" />

          {/* BestBank Text */}
          <div className="flex items-center gap-2">
            <img src={bestbankIcon} alt="" className="h-10" />
            <span 
              className="text-[32px] font-bold font-[family-name:var(--font-satoshi)] tracking-[-2px] leading-[35.2px]"
              style={{
                background: 'linear-gradient(90deg, rgba(217,217,217,1) 0%, rgba(115,115,115,0) 83.2%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              BestBank
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroPage;
