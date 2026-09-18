Component({
  properties: {
    ingredient: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onDelete() {
      this.triggerEvent('delete', { id: this.data.ingredient.id });
    }
  }
});
