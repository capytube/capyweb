import { Link } from "react-router-dom";
import magst1 from "../assets/magst1.jpeg";
import magst2 from "../assets/magst2.jpeg";
import magst3 from "../assets/magst3.jpeg";
import magst4 from "../assets/magst4.jpeg";

const AboutMagnus = () => {
  return (
    <div style={styles.container}>
      {/* CapyTube Section */}
      <section style={styles.capyTubeSection}>
        <h1 style={styles.header}>CapyCoin - Your Gateway to CapyTube</h1>
        <p style={styles.paragraph}>
          Welcome to <strong>CapyCoin</strong>, your exclusive entry into the
          charming world of capybara live streams! Here, you can watch your
          favorite capybara, <strong>Magnus</strong>, and participate in his
          everyday adventures. Our platform allows you to tip Magnus or even
          vote on tasks for him to complete using <strong>CapyCoins</strong>,
          our unique currency.
        </p>
        <p style={styles.paragraph}>
          On CapyTube, you’ll have the chance to guide Magnus through his
          activities, whether he’s lounging in a hot spring, munching on his
          favorite snacks, or exploring new territories. With CapyCoins, you
          don’t just watch Magnus — you actively participate in his life!
        </p>
        <div style={styles.imageWrapper}>
          <img
            src={magst1}
            alt="Magnus lounging in a hot spring"
            style={styles.image}
          />
          <img
            src={magst2}
            alt="Magnus enjoying a watermelon"
            style={styles.image}
          />
        </div>
      </section>

      {/* Magnus Story Section */}
      <section style={styles.magnusSection}>
        <h2 style={styles.subHeader}>The Story of Magnus</h2>
        <p style={styles.paragraph}>
          Magnus is no ordinary capybara. Born in the{" "}
          <strong>north of Thailand</strong>, he’s the second-generation
          capybara in his lineage, with a rich history of travel and adventure.
          From Thailand to various countries around the world, Magnus has become
          a symbol of peace, relaxation, and joy for everyone he meets.
        </p>
        <p style={styles.paragraph}>
          Magnus is the star of our platform for a reason. Not only is he an
          adventurous capybara, but he’s also the heart and soul behind two
          major attractions:
        </p>
        <ul style={styles.list}>
          <li>
            <strong>Magnus' Capybara Café:</strong> A one-of-a-kind café
            experience where the theme and ambiance are all inspired by Magnus
            himself.
          </li>
          <li>
            <strong>Magnus' Climbing Gym:</strong> An adventurous, world-class
            climbing gym that brings Magnus' spirit of exploration and play to
            life.
          </li>
        </ul>
        <p style={styles.paragraph}>
          When he’s not running his café or gym, Magnus spends his time doing
          what he loves most — <strong>swimming</strong>,{" "}
          <strong>bathing in hot springs</strong>, and snacking on his favorite
          foods like <strong>watermelons</strong>, <strong>cucumbers</strong>,
          and the occasional treat of <strong>banana peels</strong>. His
          all-time favorite, though, is <strong>carrot pudding</strong>.
        </p>
        <div style={styles.imageWrapper}>
          <img
            src={magst3}
            alt="Magnus in his climbing gym"
            style={styles.image}
          />
          <img
            src={magst4}
            alt="Magnus eating carrot pudding"
            style={styles.image}
          />
        </div>
        <p style={styles.paragraph}>
          Though Magnus has many capybara friends, he’s incredibly{" "}
          <strong>tame</strong> and adores spending time with humans. In fact,
          he often prefers human companionship, soaking up the attention and
          love from everyone he meets. This makes him the perfect capybara to
          engage with our community and share his life with viewers worldwide.
        </p>
      </section>

      <Link to="/" style={styles.link}>
        Go Back Home
      </Link>
    </div>
  );
};

// Inline styles for the page
const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
    color: "white",
    lineHeight: "1.6",
  },
  header: {
    fontSize: "36px",
    marginBottom: "20px",
    color: "#4CAF50",
  },
  subHeader: {
    fontSize: "28px",
    marginBottom: "15px",
    color: "#FF7043",
  },
  paragraph: {
    marginBottom: "15px",
    color: "#000",
  },
  list: {
    marginBottom: "15px",
    listStyleType: "disc",
    paddingLeft: "20px",
    color: "#000",
  },
  imageWrapper: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  image: {
    width: "300px",
    height: "auto",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  link: {
    display: "inline-block",
    marginTop: "20px",
    padding: "10px 15px",
    backgroundColor: "#4CAF50",
    color: "#fff",
    textDecoration: "none",
    borderRadius: "5px",
  },
  capyTubeSection: {
    marginBottom: "40px",
  },
  magnusSection: {
    marginBottom: "40px",
  },
};

export default AboutMagnus;
