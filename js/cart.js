// ===== CART FUNCTIONS =====

function addToCartFromFloor(seq, commodity, producer) {
  const buyer = prompt('Enter buyer name:', '');
  if (!buyer) return;
  const qty = parseInt(prompt('Enter quantity:', '1')) || 1;
  const price = parseFloat(prompt('Enter price (R):', '0')) || 0;

  if (qty <= 0 || price <= 0) {
    alert('Quantity and price must be greater than 0.');
    return;
  }

  const sale = {
    id: 'sale_' + Date.now(),
    buyer: buyer.toUpperCase(),
    items: [{
      seq: seq,
      commodity: commodity,
      producer: producer || 'Unknown',
      qty: qty,
      price: price
    }],
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  saveCartToFirebase(sale);
  alert('✅ Added to cart! The booking clerk will see it.');
}

async function saveCartToFirebase(sale) {
  try {
    await firebase.database().ref('cart/' + sale.id).set(sale);
    console.log('Cart item saved:', sale.id);
  } catch (error) {
    console.error('Error saving cart:', error);
    alert('Error adding to cart. Please try again.');
  }
}
}
