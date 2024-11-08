type Props = {
  data: {
    name: string;
    image: string;
    rotate: number;
  };
};

function CharacterCard({ data }: Props) {
  return (
    <div className="flex flex-col justify-between items-center cursor-pointer ">
      <img src={data?.image} alt={data?.name} />
      <div
        className={`border-4 border-chocoBrown bg-babyCronYellow rounded-lg md:text-5xl text-titleSizeSM text-chocoBrown font-dynapuff md:py-2.5 py-1 px-2 md:px-5 w-fit rotate-[${data?.rotate}deg]`}
      >
        {data?.name}
      </div>
    </div>
  );
}

export default CharacterCard;
