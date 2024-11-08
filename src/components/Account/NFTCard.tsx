type Props = {
  data: {
    imageSrc: string;
    title: string;
  };
};

function NFTCard({ data }: Props) {
  return (
    <div className="w-fit min-w-[172px] bg-white p-4 flex flex-col gap-y-4 items-center rounded-lg">
      <img src={data?.imageSrc} width={366} alt="image" />
      <p className="font-commissioner sm:text-3xl text-sm text-chocoBrown font-normal">
        {data?.title}
      </p>
      <button
        type="button"
        className="border-4 border-chocoBrown rounded-lg shadow-buttonShadow bg-babyCronYellow font-ADLaM sm:py-2 py-1 px-4 text-chocoBrown sm:text-3xl text-base max-h-[57px]"
      >
        View
      </button>
    </div>
  );
}

export default NFTCard;
