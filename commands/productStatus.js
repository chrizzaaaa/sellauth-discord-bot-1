import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

// Color emoji mapping
const COLOR_EMOJIS = {
  '#e74c3c': '🔴', // Red
  '#e67e22': '🟠', // Orange
  '#f1c40f': '🟡', // Yellow
  '#2ecc71': '🟢', // Green
  '#3498db': '🔵', // Blue
  'null': '⚪'     // Default/null
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
    try {
      const productId = interaction.options.getString('id');
      const statusText = interaction.options.getString('text');
      const statusColor = interaction.options.getString('color');
      
      // Convert 'null' string to actual null value
      const finalStatusColor = statusColor === 'null' ? null : statusColor;

      // Get current product data
      const product = await api.get(`shops/${api.shopId}/products/${productId}`);

      // Prepare the update payload with all required fields
      const updatePayload = {
        id: parseInt(productId),
        name: product.name,
        path: product.path,
        description: product.description,
        price: product.price,
        currency: product.currency,
        payment_methods: product.payment_methods || [],
        deliverables: product.deliverables,
        deliverables_type: product.deliverables_type,
        stock: product.stock || 0,
        type: product.type || 'single',
        status_text: statusText,
        status_color: finalStatusColor,
        price_slash: product.price_slash || null,
        image_url: product.image_url || null,
        group_id: product.group_id || null,
        shop_id: parseInt(api.shopId),
        instructions: product.instructions || '',
        out_of_stock_message: product.out_of_stock_message || '',
        sort_priority: product.sort_priority || 0,
        visibility: product.visibility || 'public',
        quantity_min: product.quantity_min || null,
        quantity_max: product.quantity_max || null,
        discord_required: product.discord_required || 0,
        discord_guild_id: product.discord_guild_id || null,
        discord_role_id: product.discord_role_id || null,
        block_vpn: product.block_vpn || 0,
        custom_fields: product.custom_fields || [],
        volume_discounts: product.volume_discounts || []
      };

      // Update product with new status
      await api.put(`shops/${api.shopId}/products/${productId}/update`, updatePayload);

      // Get emoji for selected color
      const colorEmoji = COLOR_EMOJIS[statusColor] || '⚪';

      const embed = new EmbedBuilder()
        .setTitle('Product Status Updated')
        .setDescription(`Status updated for product: ${product.name}`)
        .addFields(
          { name: 'Status Text', value: statusText, inline: true },
          { name: 'Status Color', value: colorEmoji, inline: true }
        )
        .setColor(finalStatusColor || '#6571ff')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error details:', error);
      return interaction.reply({ 
        content: 'Failed to update product status. Error: ' + error.message,
        ephemeral: true 
      });
    }
  }
}; 