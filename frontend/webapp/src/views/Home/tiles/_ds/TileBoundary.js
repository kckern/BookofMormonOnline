import React from "react";

/**
 * TileBoundary — per-tile error boundary for the Home sampler (audit M2).
 *
 * Wraps a whole tile (its `.tile` shell included), so a tile that throws while
 * rendering disappears entirely: no empty shell, and the rest of the grid keeps
 * rendering. The crash is reported once via console.warn.
 */
export default class TileBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("tile crashed:", this.props.tileKey, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
