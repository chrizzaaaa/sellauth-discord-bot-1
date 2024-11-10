import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

// emoji for status colors
const COLOR_EMOJIS = {
  '#e74c3c': '🔴',
  '#e67e22': '🟠',
  '#f1c40f': '🟡',
  '#2ecc71': '🟢',
  '#3498db': '🔵',
  'null': '⚪'
};

export default {
  data: new SlashCommandBuilder()
    .setName('product-status')
    .setDescription('Edit a product status.')
    .addStringOption((option) => 
      option.setName('id')
        .setDescription('The product ID')
        .setRequired(true))
    .addStringOption((option) => 
      option.setName('text')
        .setDescription('The status text')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('color')
        .setDescription('The status color')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Red', value: '#e74c3c' },
          { name: '🟠 Orange', value: '#e67e22' },
          { name: '🟡 Yellow', value: '#f1c40f' },
          { name: '🟢 Green', value: '#2ecc71' },
          { name: '🔵 Blue', value: '#3498db' },
          { name: '⚪ Default', value: 'null' }
        )),

  onlyWhitelisted: true,

  async execute(interaction, api) {
    const productId = interaction.options.getString('id');
    const statusText = interaction.options.getString('text');
    const statusColor = interaction.options.getString('color');
    
    try {
      // Get current product data
      const product = await api.get(`shops/${api.shopId}/products/${productId}`);

      // Create the update payload with all required fields
      const updatePayload = {
        ...product,
        status_text: statusText,
        status_color: statusColor === 'null' ? null : statusColor,
        badge_color: product.badge_color || null,
        badge_text: product.badge_text || null,
        stock_count: product.stock_count || 0,
        images: product.images || [],
        cloudflare_image_id: product.cloudflare_image_id || null,
        group_sort_priority: product.group_sort_priority || 0,
        id: parseInt(productId),
        shop_id: parseInt(api.shopId),
        custom_fields: product.custom_fields || [],
        volume_discounts: product.volume_discounts || [],
        payment_methods: product.payment_methods || []
      };

      // Send update request to the server
      await api.put(`shops/${api.shopId}/products/${productId}/update`, updatePayload);

      const colorEmoji = COLOR_EMOJIS[statusColor] || '⚪';
      const embed = new EmbedBuilder()
        .setTitle('Product Status Updated')
        .setDescription(`Status updated for product: ${product.name}`)
        .addFields(
          { name: 'Status Text', value: statusText, inline: true },
          { name: 'Status Color', value: colorEmoji, inline: true }
        )
        .setColor(statusColor === 'null' ? '#6571ff' : statusColor)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error updating product status:', error);
      return interaction.reply({ 
        content: 'Failed to update product status. Error: ' + error.message,
        ephemeral: true 
      });
    }
  }
}; 
