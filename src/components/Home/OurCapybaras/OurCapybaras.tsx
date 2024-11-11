import CapyProfile from "./CapyProfile/CapyProfile";
import styles from "./OurCapybaras.module.css";
import fruitIcon from "../../../assets/fruit.svg";
import flowerIcon from "../../../assets/flower.svg";
import magnusImg from "../../../assets/magnus.jpg";
import elonImg from "../../../assets/elon.jpg";
import einsteinImg from "../../../assets/einstein.jpg";

interface Detail {
  title: string;
  description: string;
}

export interface CapybaraData {
  id: number;
  image: string;
  name: string;
  gender: string;
  dob: string;
  location: string;
  bio: string | null;
  details: Detail[];
}

const capyData: CapybaraData[] = [
  {
    id: 1,
    image: magnusImg,
    name: "Magnus",
    gender: "Male",
    dob: "7 months",
    location: "Born in Bangkok, Thailand",
    bio: "Named after Magnus the climber and chess champion 🧗♟️.",
    details: [
      {
        title: "Personality:",
        description:
          "Magnus is the softest soul in the gang. He loves being the center of attention and is happiest when he’s close to someone. Big on snuggles and endless belly rubs, Magnus just can’t get enough love!",
      },
      {
        title: "Favourite treat:",
        description: "🍎 (but in moderation!)",
      },
    ],
  },
  {
    id: 2,
    image: elonImg,
    name: "Elon",
    gender: "Male",
    dob: "2 months",
    location: "Born in South America",
    bio: "Named after the Elon Musk, for his eccentric personality.",
    details: [
      {
        title: "Personality:",
        description:
          "Fearless and full of energy, Elon is always looking for his next thrill! He’s a natural daredevil, whether it’s jumping from high places or scaling fences.",
      },
      {
        title: "Favorite Hobby:",
        description: "Exploring every nook and cranny he can find 🔍",
      },
    ],
  },
  {
    id: 3,
    image: einsteinImg,
    name: "Einstein",
    gender: "Male",
    dob: "2 months",
    location: "South America (in a different spot from Elon!)",
    bio: null,
    details: [
      {
        title: "Personality:",
        description:
          "Einstein may be shy, but don’t let that fool you—he’s the smartest one in the gang! Although he scares easily, he’s always hatching little plans to explore and even once plotted an escape!",
      },
      {
        title: "Fun facts:",
        description:
          "Beneath his timid shell lies a clever capybara who’s always one step ahead, ready to explore… as long as it’s safe!",
      },
    ],
  },
];

const OurCapybaras = () => {
  return (
    <div className={styles.ourCapybarasWrapper}>
      <h1>
        <img src={fruitIcon} alt="orange" /> Our Capybaras{" "}
        <img src={flowerIcon} alt="flower" />
      </h1>

      <div className={styles.ourCapybarasProfilesCards}>
        {capyData?.map((data, index) => {
          return (
            <CapyProfile
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

export default OurCapybaras;
