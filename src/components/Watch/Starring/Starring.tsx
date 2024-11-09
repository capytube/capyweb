import CapyCards from "./CapyCards/CapyCards";
import styles from "./Starring.module.css";
import starringMagnus from "../../../assets/starringMagnus.jpg";

export interface StarringData {
  id: number;
  image: string;
  name: string;
  bio: string | null;
  url: string;
  streamCount: string;
}

const capyData: StarringData[] = [
  {
    id: 1,
    image: starringMagnus,
    name: "Magnus",
    bio: "Watch our biggest naughty boy munching and chasing his little brother",
    url: "#",
    streamCount: "3",
  },
  {
    id: 2,
    image: starringMagnus,
    name: "Elon",
    bio: "This fearless bad boy doesn’t afraid of anything. Chatty and full of energy. A truely socialised capy.",
    url: "#",
    streamCount: "3",
  },
  {
    id: 3,
    image: starringMagnus,
    name: "Einstein",
    bio: "The youngest and shy baby loves to plan a prison break. Brainy of the boys. The mastermind capy lord.",
    url: "#",
    streamCount: "3",
  },
];

const Starring = () => {
  return (
    <div className={styles.starringWrapper}>
      <h1>STARRING...</h1>

      <div className={styles.starringCapyCardsWrapper}>
        {capyData?.map((data, index) => {
          return (
            <CapyCards
              data={data}
              key={data.id}
              customCardStyle={{
                transform: `rotate(${index % 2 === 0 ? "-1deg" : "1deg"})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Starring;