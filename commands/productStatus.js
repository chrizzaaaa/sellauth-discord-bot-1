import { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';

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
    const expiredEmbed = new EmbedBuilder()
      .setTitle('Time Expired')
      .setDescription('Time expired. Please try again.')
      .setColor('#e74c3c');

    // Search products by name
    const searchButton = new ButtonBuilder()
      .setCustomId('show-search-modal')
      .setLabel('Search Product')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
      .addComponents(searchButton);

    const message = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Updating Product Status')
          .setDescription('Click the button below to search for a product')
          .setColor('#6571ff')
      ],
      components: [row],
      fetchReply: true
    });

    const modal = new ModalBuilder()
      .setCustomId('product-search-modal')
      .setTitle('Search Product');

    const productNameInput = new TextInputBuilder()
      .setCustomId('productName')
      .setLabel('Enter product name to search')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(productNameInput);
    modal.addComponents(firstActionRow);

    try {
      const collector = message.createMessageComponentCollector({
        filter: i => i.customId === 'show-search-modal' && i.user.id === interaction.user.id,
        time: 120000
      });

      collector.on('collect', async (buttonInteraction) => {
        await buttonInteraction.showModal(modal);

        try {
          const modalSubmit = await buttonInteraction.awaitModalSubmit({
            filter: i => i.customId === 'product-search-modal',
            time: 120000
          });

          const searchName = modalSubmit.fields.getTextInputValue('productName');
          const products = await api.get(`shops/${api.shopId}/products`);
          
          const matchedProducts = products.data.filter(product => 
            product.name.toLowerCase().includes(searchName.toLowerCase())
          );

          if (matchedProducts.length === 0) {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('Product Search Failed')
                  .setDescription('No products found matching that name.')
                  .setColor('#e74c3c')
              ],
              components: []
            });
            await modalSubmit.deferUpdate();
            return;
          }

          if (matchedProducts.length === 1) {
            await this.updateProductStatus(interaction, api, matchedProducts[0].id, interaction.options.getString('text'), interaction.options.getString('color'), matchedProducts[0].name);
            await modalSubmit.deferUpdate();
            return;
          }

          // Update main message to show waiting message
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('Updating Product Status')
                .setDescription('Waiting for product selection...')
                .setColor('#6571ff')
            ],
            components: []
          });

          // Show product selection menu in ephemeral message
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('product-select')
            .setPlaceholder('Select a product')
            .addOptions(
              matchedProducts.map(product => ({
                label: `${product.name} (${product.stock === null ? 'stock not found' : product.stock + ' in stock'})`,
                value: product.id.toString()
              }))
            );

          const menuRow = new ActionRowBuilder().addComponents(selectMenu);
          
          await modalSubmit.deferUpdate();
          
          const selectionMessage = await interaction.followUp({
            content: 'Multiple products found. Please select one:',
            components: [menuRow],
            ephemeral: true
          });

          try {
            const selection = await selectionMessage.awaitMessageComponent({
              filter: i => i.customId === 'product-select' && i.user.id === interaction.user.id,
              time: 30000
            });

            const selectedProduct = matchedProducts.find(p => p.id.toString() === selection.values[0]);
            await this.updateProductStatus(interaction, api, selection.values[0], interaction.options.getString('text'), interaction.options.getString('color'), selectedProduct.name);
            await selection.deferUpdate();
          } catch (err) {
            await interaction.editReply({
              embeds: [expiredEmbed],
              components: []
            });
            return;
          }

        } catch (error) {
          await interaction.editReply({
            embeds: [expiredEmbed],
            components: []
          });
          return;
        }
      });

      collector.on('end', () => {
        interaction.editReply({
          embeds: [expiredEmbed],
          components: []
        });
      });

    } catch (error) {
      console.error(error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Error')
            .setDescription('An error occurred while processing your request.')
            .setColor('#e74c3c')
        ],
        components: []
      });
    }
  },

  async updateProductStatus(interaction, api, productId, statusText, statusColor, productName) {
    try {
      await api.put(`shops/${api.shopId}/products/bulk-update/status`, {
        product_ids: [productId],
        status_color: statusColor === 'null' ? null : statusColor,
        status_text: statusText
      });

      const colorEmoji = COLOR_EMOJIS[statusColor] || '⚪';
      const embed = new EmbedBuilder()
        .setTitle('Product Status Updated')
        .setDescription(`Status updated for product: **${productName}** (ID: ${productId})`)
        .addFields(
          { name: 'Status Text', value: statusText, inline: true },
          { name: 'Status Color', value: colorEmoji, inline: true }
        )
        .setColor(statusColor === 'null' ? '#6571ff' : statusColor)
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Error updating product status:', error);

      return interaction.editReply({ 
        content: 'Failed to update product status. Error: ' + error.message,
        ephemeral: true 
      });
    }
  }
}; 
