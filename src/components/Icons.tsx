/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export const Icon = ({ name, className = 'text-base' }) => html`
  <span class="material-symbols-outlined ${className}">${name}</span>
`;

export const ICONS = {
    // General
    building: html`<${Icon} name="apartment" />`,
    users: html`<${Icon} name="group" />`,
    chart: html`<${Icon} name="bar_chart" />`,
    logout: html`<${Icon} name="logout" />`,
    home: html`<${Icon} name="home" />`,
    menu: html`<${Icon} name="menu" />`,
    close: html`<${Icon} name="close" />`,
    chevron_right: html`<${Icon} name="chevron_right" className="text-xl" />`,
    chevron_left: html`<${Icon} name="chevron_left" className="text-xl" />`,
    chevron_down: html`<${Icon} name="expand_more" className="text-xl" />`,
    chevron_up: html`<${Icon} name="expand_less" className="text-xl" />`,
    settings: html`<${Icon} name="settings" />`,
    business: html`<${Icon} name="business_center" />`,
    add: html`<${Icon} name="add" />`,
    arrow_back: html`<${Icon} name="arrow_back" />`,
    credit_card: html`<${Icon} name="credit_card" />`,
    key: html`<${Icon} name="key" />`,
    upload_file: html`<${Icon} name="upload_file" />`,
    download: html`<${Icon} name="download" />`,
    storefront: html`<${Icon} name="storefront" />`,
    drag_handle: html`<${Icon} name="drag_indicator" />`,
    search: html`<${Icon} name="search" />`,
    payments: html`<${Icon} name="payments" />`,
    qr_code_2: html`<${Icon} name="qr_code_2" />`,
    shopping_cart: html`<${Icon} name="shopping_cart" />`,
    paid: html`<${Icon} name="paid" />`,
    credit_score: html`<${Icon} name="credit_score" />`,
    currency_exchange: html`<${Icon} name="currency_exchange" />`,
    calendar_month: html`<${Icon} name="calendar_month" />`,
    refresh: html`<${Icon} name="refresh" />`,
    package_2: html`<${Icon} name="package_2" />`,
    person_add: html`<${Icon} name="person_add" />`,
    emoji_events: html`<${Icon} name="emoji_events" />`,
    history_edu: html`<${Icon} name="history_edu" />`,


    // Connectivity
    wifi: html`<${Icon} name="wifi" />`,
    wifi_off: html`<${Icon} name="wifi_off" />`,

    // Notifications
    notifications: html`<${Icon} name="notifications" className="text-2xl" />`,
    support: html`<${Icon} name="support_agent" className="text-2xl" />`,
    
    // Form
    eye: html`<${Icon} name="visibility" className="text-xl" />`,
    eyeSlash: html`<${Icon} name="visibility_off" className="text-xl" />`,
    add_circle: html`<${Icon} name="add_circle" />`,
    remove_circle: html`<${Icon} name="remove_circle" />`,

    // Dashboard & Navigation
    dollar: html`<${Icon} name="monetization_on" className="text-primary" />`,
    inventory: html`<${Icon} name="inventory_2" />`,
    edit_note: html`<${Icon} name="edit_note" />`,
    products: html`<${Icon} name="style" />`,
    category: html`<${Icon} name="category" />`,
    activity: html`<${Icon} name="history" />`,
    bolt: html`<${Icon} name="bolt" />`,
    newSale: html`<${Icon} name="point_of_sale" className="text-2xl text-primary" />`,
    newProduct: html`<${Icon} name="add_shopping_cart" className="text-2xl text-primary" />`,
    newExpense: html`<${Icon} name="receipt_long" className="text-2xl text-primary" />`,
    pos: html`<${Icon} name="point_of_sale" />`,
    purchases: html`<${Icon} name="shopping_bag" />`,
    sales: html`<${Icon} name="monitoring" />`,
    suppliers: html`<${Icon} name="local_shipping" />`,
    clients: html`<${Icon} name="people" />`,
    transfers: html`<${Icon} name="sync_alt" />`,
    expenses: html`<${Icon} name="payments" />`,
    local_offer: html`<${Icon} name="local_offer" />`,

    // Toast & Modal Icons
    success: html`<${Icon} name="check_circle" className="text-green-500 text-2xl" />`,
    error: html`<${Icon} name="error" className="text-red-500 text-2xl" />`,
    info: html`<${Icon} name="info" className="text-blue-500 text-2xl" />`,
    warning: html`<${Icon} name="warning" className="text-yellow-500 text-2xl" />`,
    warning_amber: html`<${Icon} name="warning" className="text-amber-400 text-3xl" />`,

    // SuperAdmin Actions
    edit: html`<${Icon} name="edit" />`,
    delete: html`<${Icon} name="delete" />`,
    suspend: html`<${Icon} name="pause_circle" />`,
    activate: html`<${Icon} name="play_circle" />`,
};