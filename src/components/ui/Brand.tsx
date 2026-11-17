import styles from "./Brand.module.css";
import { cx } from "@/utils/cx";

interface BrandProps {
  size?: "md" | "lg";
  inverted?: boolean;
}

/** Logo do Acolhe. */
export function Brand({ size = "md", inverted = false }: BrandProps) {
  return (
    <span className={cx(styles.brand, styles[size], inverted && styles.inverted)}>
      <span className={styles.mark}>
        <img src="/logo_acolhe.svg" alt="" aria-hidden="true" />
      </span>
      <span>
        <strong>Acolhe</strong>
      </span>
    </span>
  );
}
