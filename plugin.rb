# frozen_string_literal: true

# name: custom-group-banner
# about: TODO
# meta_topic_id: TODO
# version: 0.0.1
# authors: Gage Berz
# url: TODO
# required_version: 2.7.0

enabled_site_setting :custom_group_banner_enabled

register_asset 'stylesheets/custom-group-banner.scss'

module ::CustomGroupBanner
  PLUGIN_NAME = "custom-group-banner"
end

require_relative "lib/custom_group_banner/engine"

add_admin_route 'custom_group_banner.title', 'custom-group-banner'

Discourse::Application.routes.append do
  get '/admin/plugins/custom-group-banner' => 'admin/plugins#index', constraints: StaffConstraint.new
end

after_initialize do
  module ::DiscourseBanner
    class BannerDismissal < ::ActiveRecord::Base
      self.table_name = 'banner_dismissals'
      belongs_to :user
      validates :banner_key, presence: true
    end
  end

  add_to_serializer(:current_user, :dismissed_banners) do
    DiscourseBanner::BannerDismissal.where(user_id: object.id).pluck(:banner_key)
  end

  add_model_callback(User, :after_create) do
    DiscourseBanner::BannerDismissal.where(user_id: self.id).delete_all
  end

  add_to_class(:user, :dismiss_banner) do |banner_key|
    DiscourseBanner::BannerDismissal.create(user_id: self.id, banner_key: banner_key)
  end

  Discourse::Application.routes.append do
    post '/banner/dismiss' => 'discourse_banner/banner#dismiss'
  end

  Discourse::Application.routes.append do
    delete 'admin/banner/clear_dismissals' => 'discourse_banner/banner#clear_dismissals', constraints: StaffConstraint.new
  end

  module ::DiscourseBanner
    class BannerController < ::ApplicationController
      requires_login
      before_action :ensure_staff, only: [:clear_dismissals]

      def dismiss
        banner_key = params.require(:banner_key)
        current_user.dismiss_banner(banner_key)
        render json: success_json
      end

      def clear_dismissals
        banner_keys = params.require(:banner_keys)
        DiscourseBanner::BannerDismissal.where(banner_key: banner_keys).delete_all
        MessageBus.publish "/site/banner", { event: 'dismissals_cleared', banner_keys: banner_keys }
        render json: success_json
      end

      private

      def ensure_staff
        raise Discourse::InvalidAccess.new unless current_user&.staff?
      end
    end
  end
end