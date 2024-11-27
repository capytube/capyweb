import styles from './TopCrossRibbon.module.css';

interface Props {
  glass_clsx?: string;
  ribbon_clsx?: string;
}
const TopCrossRibbon = ({ glass_clsx, ribbon_clsx }: Props) => {
  return (
    <div className={`${styles.glassPanel} ${glass_clsx ?? ''}`}>
      <div className={`${styles.topCrossRibbon} ${ribbon_clsx ?? ''}`}>Coming soon</div>
    </div>
  );
};

export default TopCrossRibbon;
