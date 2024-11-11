type Props = {};

function getTagBG(value: string) {
  if (value === 'rare') {
    return 'bg-[#7542AB]';
  } else if (value === 'epic') {
    return 'bg-tomatoRed';
  } else {
    return 'bg-siteGreen';
  }
}

function NFTDetailsCard({}: Props) {
  return (
    <div className="w-fit min-w-[172px] flex flex-col gap-y-6 rounded-lg border border-chocoBrown p-8 max-w-[544px]">
      <img
        className="rounded-t-lg"
        src="/src/assets/account/brownRat.png"
        width={480}
        alt="image"
      />
      <span
        className={`${getTagBG(
          'ultra rare'
        )} py-1.5 px-2 text-sm text-white rounded-lg capitalize font-bold max-w-fit`}
      >
        ultra rare
      </span>
      <div>
        <span className="text-[28px] leading-8 font-ADLaM text-chocoBrown">
          Properties
        </span>
        <p className="font-commissioner text-base text-chocoBrown font-normal mb-4 mt-6">
          <strong>Chalk powder:</strong> +5 bidding bonus{' '}
        </p>
        <p className="font-commissioner text-base text-chocoBrown font-normal">
          <strong>Climbing gym:</strong> +10 minutes bonus video call{' '}
        </p>
      </div>
    </div>
  );
}

export default NFTDetailsCard;
