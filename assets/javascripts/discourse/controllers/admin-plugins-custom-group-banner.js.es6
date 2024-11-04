import Controller from "@ember/controller";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";

export default class AdminPluginsCustomGroupBannerController extends Controller {
  @service siteSettings;
  @service messageBus;
  @tracked banners = [];
  @tracked groups = [];

  constructor() {
    super(...arguments);
    this.banners = this._deserializeConfig();

    this.messageBus.subscribe("/site/banner", (data) => {
      if (data.event === "dismissals_cleared") {
        this.notifyPropertyChange("banners");
      }
    });
  this._loadGroups();
  }

  _generateUniqueId() {
    return `banner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _loadGroups() {
    try {
      const groups = await this.store.findAll('group');
      this.groups = groups.toArray();
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  }

  get availableGroups() {
    return this.groups.map((group) => ({ id: group.name, name: group.display_name }));
  }

  get availableStyles() {
    return [
      { id: "info-banner", name: "Info" },
      { id: "success-banner", name: "Success" },
      { id: "danger-banner", name: "Danger" },
    ];
  }

  _deserializeConfig() {
    const config = this.siteSettings.custom_group_banner_config;
    if (!config) return [];

    return config.split(/(?<!\\)\|/).map((entry) => {
      const [id, group, message, dismissable, className] = entry
        .split(/(?<!\\),/)
        .map((s) => s.trim().replace(/\\([,|])/g, '$1'));
      return {
        id: id,
        group,
        message,
        dismissable: dismissable === "true",
        className,
      };
    });
  }

  _serializeConfig() {
    return this.banners
      .filter((banner) => banner.group && banner.message)
      .map(
        (banner) =>
          `${banner.id},${banner.group},${banner.message.replace(/([,|])/g, '\\$1')},${banner.dismissable},${banner.className}`
      )
      .join("|");
  }

  @action
  async addBanner() {
    this.banners = [
      ...this.banners,
      {
        id: this._generateUniqueId(),
        group: this.availableGroups[0]?.id,
        message: "",
        dismissable: true,
        className: this.availableStyles[0]?.id,
      },
    ];
    await this._updateSetting();
  }

  @action
  async removeBanner(index) {
    const bannerToRemove = this.banners[index];
    try {
      this.banners = this.banners.filter((_, i) => i !== index);
      await this._updateSetting();

      // Clear dismissals for this banner
      await ajax("/admin/banner/clear_dismissals", {
        type: "DELETE",
        data: { banner_keys: [bannerToRemove.id] }
      });
    } catch (error) {
      console.error("Failed to remove banner:", error);
      this.banners = this._deserializeConfig();
    }
  }

  @action
  async updateBanner(index, field, value) {
    const updatedBanners = [...this.banners];
    updatedBanners[index] = {
      ...updatedBanners[index],
      [field]: value
    };
    this.banners = updatedBanners;
    await this._updateSetting();
  }

  async _updateSetting() {
    try {
      await ajax("/admin/site_settings/custom_group_banner_config", {
        type: "PUT",
        data: {
          custom_group_banner_config: this._serializeConfig(),
        },
      });
    } catch (error) {
      throw error;
    }
  }
}