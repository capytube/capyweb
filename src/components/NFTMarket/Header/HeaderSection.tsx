type Props = {};

export default function HeaderSection({}: Props) {
  return (
    <div
      id="nft-market"
      className="md:pt-10 py-8 px-4 md:pb-20 flex flex-col md:gap-y-10 gap-y-6 items-center"
    >
      <h1 className="font-hanaleiFill md:text-titleSize text-titleSizeSM text-chocoBrown">
        NFT marketplace
      </h1>
      <p className="font-commissioner md:text-2xl text-sm text-chocoBrown text-center max-w-[880px] mx-auto">
        Capytube arts are 8,888 unique collectible Capybaras with proof of
        ownership stored on the Solana blockchain.
      </p>
    </div>
  );
}
