import { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

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
      option.setName('product')
        .setDescription('Name of the product to update')
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
    await interaction.deferReply();

    try {
      const searchTerm = interaction.options.getString('product').toLowerCase();
      const productsResponse = await api.get(`shops/${api.shopId}/products`);
      
      if (!productsResponse || !productsResponse.data) {
        throw new Error('Invalid API response');
      }

      const products = productsResponse.data;
      const matchedProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm)
      );

      if (matchedProducts.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#e74c3c')
              .setDescription('No matching products were found.')
          ]
        });
      }

      if (matchedProducts.length === 1) {
        await this.updateProductStatus(
          interaction, 
          api, 
          matchedProducts[0].id, 
          interaction.options.getString('text'),
          interaction.options.getString('color'),
          matchedProducts[0].name
        );
        return;
      }

      const statusEmbed = new EmbedBuilder()
        .setDescription('Click the button below to search products')
        .setColor('#6571ff');

      const searchButton = new ButtonBuilder()
        .setCustomId('show-products')
        .setLabel('Search Products')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(searchButton);

      const message = await interaction.editReply({
        embeds: [statusEmbed],
        components: [row]
      });

      const collector = message.createMessageComponentCollector({
        filter: i => {
          if (i.user.id !== interaction.user.id) {
            i.reply({ content: 'Not for you!', ephemeral: true });
            return false;
          }
          return (i.customId === 'show-products' || i.customId === 'product-select');
        },
        time: 120000
      });

      let selectionMessage = null;

      collector.on('collect', async (i) => {
        if (i.customId === 'show-products') {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('product-select')
            .setPlaceholder('Select a product')
            .addOptions(
              matchedProducts.map(product => ({
                label: product.name,
                value: product.id.toString()
              }))
            );

          const menuRow = new ActionRowBuilder().addComponents(selectMenu);
          
          selectionMessage = await i.reply({
            embeds: [new EmbedBuilder()
              .setDescription('Select a product from the menu:')
              .setColor('#6571ff')],
            components: [menuRow],
            ephemeral: true,
            fetchReply: true
          });

          try {
            const selection = await selectionMessage.awaitMessageComponent({
              filter: i => i.customId === 'product-select' && i.user.id === interaction.user.id,
              time: 120000
            });

            const selectedProduct = matchedProducts.find(p => p.id.toString() === selection.values[0]);
            await selection.deferUpdate();
            await this.updateProductStatus(
              interaction,
              api,
              selection.values[0],
              interaction.options.getString('text'),
              interaction.options.getString('color'),
              selectedProduct.name
            );
            
            collector.stop('completed');
          } catch (error) {
            if (error.code === 'InteractionCollectorError') {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setDescription('Selection time expired. Please try again.')
                ],
                components: []
              });
            } else {
              console.error('Error selecting product:', error);
            }
          }
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason !== 'completed' && message.editable) {
          interaction.editReply({
            components: []
          }).catch(() => {});
        }
      });

    } catch (error) {
      console.error('Error updating product status:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#e74c3c')
            .setDescription('An error occurred while updating the product status')
        ]
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
        .setDescription(`Status updated for product: **${productName}**`)
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
      await interaction.editReply({ 
        embeds: [
          new EmbedBuilder()
            .setColor('#e74c3c')
            .setDescription('Failed to update product status')
        ],
        components: []
      });
    }
  }
}; 
