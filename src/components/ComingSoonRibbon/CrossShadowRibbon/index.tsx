import styles from './CrossShadowRibbon.module.css';

interface Props {
  clsx?: string;
}

const CrossShadowRibbon = ({ clsx }: Props) => {
  return <div className={`${styles.crossShadowRibbon} ${clsx ?? ''}`}>Coming Soon</div>;
};

export default CrossShadowRibbon;
