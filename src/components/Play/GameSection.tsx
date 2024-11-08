import PlayCards from './PlayCards';
import SelectedCharacterCard from './SelectedCharacterCard';

type Props = {};

function GameSection({}: Props) {
  return (
    <div id="game-section" className="py-20">
      <div className="max-w-[1100px] my-0 mx-auto flex gap-x-10">
        <SelectedCharacterCard />
        <PlayCards />
      </div>
    </div>
  );
}

export default GameSection;
