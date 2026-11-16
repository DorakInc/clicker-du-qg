// Réserve de nœuds d'effets réutilisables : rien n'est créé pendant le jeu,
// et le nombre d'effets visibles ne peut jamais dépasser la taille de la réserve.

export function createPool(layer, { className, size, build }) {
  const free = [];
  const used = [];

  for (let i = 0; i < size; i += 1) {
    const node = document.createElement('div');
    node.hidden = true;
    node.dataset.base = className;
    node.className = className;
    node.gen = 0;
    build?.(node);
    layer.append(node);
    free.push(node);
  }

  function stop(node) {
    for (const anim of node.getAnimations({ subtree: true })) anim.cancel();
  }

  const pool = {
    get active() { return used.length; },
    get available() { return free.length; },
    oldest() { return used[0]; },

    /** Prend un nœud libre ; si `recycle`, réutilise le plus ancien quand la réserve est vide. */
    acquire({ recycle = false, extra = '' } = {}) {
      let node = free.pop();
      if (!node) {
        if (!recycle || !used.length) return null;
        node = used.shift();
        stop(node);
      }
      node.gen += 1;
      node.className = extra ? `${node.dataset.base} ${extra}` : node.dataset.base;
      node.removeAttribute('style');
      node.hidden = false;
      used.push(node);
      return node;
    },

    /** Rend un nœud ; ignoré si le nœud a été recyclé entre-temps (génération différente). */
    release(node, gen = node.gen) {
      if (node.gen !== gen) return;
      const index = used.indexOf(node);
      if (index === -1) return;
      used.splice(index, 1);
      stop(node);
      node.hidden = true;
      free.push(node);
    },

    releaseAll() {
      while (used.length) pool.release(used[0]);
    },
  };
  return pool;
}
