import { Link } from 'react-router-dom';

import FrameCapy from '/src/assets/account/noLogin/frame-capy.png';
import TVRemote from '/src/assets/account/noLogin/tv-remote.png';
import ExclusiveCapy from '/src/assets/account/noLogin/exclusive-capy.png';

type Props = { clx?: string };

const cards = [
  {
    id: 1,
    img: FrameCapy,
    title: 'Own Unique NFT Art',
    description:
      'Get a special NFT collectible to store in your wallet. Each NFT isn’t just a piece of art—it’s packed with unique abilities that let you interact with the capybaras like a true VIP! Buy more NFTs to unlock even more special powers.',
  },
  {
    id: 2,
    img: TVRemote,
    title: ' Choose Your Own View',
    description:
      'Say goodbye to downtime! As a premium member, you have full control over which camera you want to watch, giving you uninterrupted, up-close access to your favourite capybara moments.',
  },
  {
    id: 3,
    img: ExclusiveCapy,
    title: ' Exclusive Content, Just for You',
    description:
      'Access behind-the-scenes footage and special capybara content made only for our premium members. It’s your ticket to the cutest, most exclusive moments!',
  },
];

function NftSection({ clx }: Props) {
  return (
    <div
      id="login-nft-section"
      className={`md:pt-10 md:pb-20 md:px-[152px] py-8 pb-8 ${clx}  px-4 flex flex-col justify-center items-center md:gap-y-10 gap-y-4`}
    >
      <h2 className="font-hanaleiFill md:text-titleSize text-titleSizeSM text-chocoBrown">Premium NFT membership</h2>
      <div>
        <h4 className="text-center font-ADLaM text-chocoBrown md:text-4xl text-xl font-semibold pb-6">
          Unlock the Ultimate Capytube Experience
        </h4>
        <p className="text-center font-commissioner text-chocoBrown md:text-titleSizeSM text-sm">
          Here’s what’s waiting for you:
        </p>
      </div>
      <div className="flex md:flex-row flex-col gap-x-10 gap-y-6">
        {cards?.map((card) => (
          <div key={card?.id} className="md:px-4 max-w-md">
            <img src={card?.img} alt="winodw" className="mx-auto md:max-h-max max-h-[150px]" />
            <p className="md:pt-10 pt-4 font-ADLaM md:text-[28px] md:leading-8 text-base text-center text-chocoBrown font-semibold md:pb-10 pb-6">
              {card?.title}
            </p>
            <p className="font-commissioner md:text-titleSizeSM text-sm text-center text-chocoBrown">
              {card?.description}
            </p>
          </div>
        ))}
      </div>
      <Link to="/shop" target="_blank" rel="noreferrer">
        <button
          className="md:-rotate-1 bg-darkOrange font-ADLaM text-white md:text-3xl md:py-2.5 py-1 px-4 rounded-lg md:shadow-loginShadow shadow-buttonShadow relative disabled:cursor-not-allowed disabled:bg-buttonDisabled disabled:shadow-buttonDisabledShadow"
        >
          Buy NFT & Join Premium ✨
        </button>
      </Link>
    </div>
  );
}

export default NftSection;
